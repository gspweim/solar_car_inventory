"""
POST /cars/{car_id}/parts/{part_id}/replace
Write access required.

Workflow:
1. Mark the current part as inactive (retired) and log it to PartHistory
2. If "replace_with_same" is true, create a new part with the same model but 0 miles
3. Return the history record and (optionally) the new part

Body:
{
  "reason": "failure|upgrade|routine_maintenance|other",
  "note": "Free text explanation",
  "replace_with_same": true|false
}
"""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from utils import ok, bad_request, not_found, forbidden, require_write

PARTS_TABLE = os.environ["PARTS_TABLE"]
PART_HISTORY_TABLE = os.environ["PART_HISTORY_TABLE"]
dynamodb = boto3.resource("dynamodb")
parts_table = dynamodb.Table(PARTS_TABLE)
history_table = dynamodb.Table(PART_HISTORY_TABLE)

VALID_REASONS = ["failure", "upgrade", "routine_maintenance", "other"]


@require_write
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    path = event.get("pathParameters") or {}
    car_id = path.get("car_id")
    part_id = path.get("part_id")

    if not car_id or not part_id:
        return bad_request("car_id and part_id path parameters are required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    reason = body.get("reason", "").strip()
    note = body.get("note", "").strip()
    replace_with_same = body.get("replace_with_same", False)

    if not reason:
        return bad_request("reason is required")
    if reason not in VALID_REASONS:
        return bad_request(f"reason must be one of: {', '.join(VALID_REASONS)}")

    # Fetch the part
    resp = parts_table.get_item(Key={"part_id": part_id})
    old_part = resp.get("Item")
    if not old_part:
        return not_found("Part not found")
    if old_part.get("car_id") != car_id:
        return forbidden("Part does not belong to this car")
    if not old_part.get("active", True):
        return bad_request("Part is already retired")

    now = datetime.now(timezone.utc).isoformat()

    # 1. Mark old part as inactive
    parts_table.update_item(
        Key={"part_id": part_id},
        UpdateExpression="SET #active = :false, #updated_at = :now, #retired_at = :now",
        ExpressionAttributeNames={
            "#active": "active",
            "#updated_at": "updated_at",
            "#retired_at": "retired_at",
        },
        ExpressionAttributeValues={":false": False, ":now": now},
    )

    # 2. Write history record
    history_record = {
        "history_id": str(uuid.uuid4()),
        "car_id": car_id,
        "part_id": part_id,
        "part_number": old_part.get("part_number", ""),
        "part_name": old_part.get("part_name", ""),
        "part_group": old_part.get("part_group", ""),
        "part_location": old_part.get("part_location", ""),
        "miles_at_retirement": old_part.get("miles_used", 0),
        "reason": reason,
        "note": note,
        "replaced_by": user["email"],
        "replaced_at": now,
        "extra_fields": old_part.get("extra_fields", {}),
    }
    history_table.put_item(Item=history_record)

    new_part = None
    if replace_with_same:
        # 3. Create a fresh copy with 0 miles
        new_part = {
            "part_id": str(uuid.uuid4()),
            "car_id": car_id,
            "part_number": old_part.get("part_number", ""),
            "part_name": old_part.get("part_name", ""),
            "part_group": old_part.get("part_group", ""),
            "part_location": old_part.get("part_location", ""),
            "miles_used": 0,
            "active": True,
            "created_at": now,
            "updated_at": now,
            "created_by": user["email"],
            "purchased_from": old_part.get("purchased_from", ""),
            "cost": old_part.get("cost", ""),
            "extra_fields": old_part.get("extra_fields", {}),
            "replaced_from_history_id": history_record["history_id"],
        }
        parts_table.put_item(Item=new_part)

    result = {
        "message": "Part replaced successfully",
        "history": history_record,
    }
    if new_part:
        result["new_part"] = new_part

    return ok(result)
