"""
POST /cars/{car_id}/parts
Write access required. Create a new part on a car.

Required body fields:
  part_number, part_name, part_group, part_location

Optional standard fields:
  miles_used (default 0)

Optional dynamic fields (any key/value pairs under "extra_fields"):
  { "wrench_size": "10mm", "thread": "M8", "designer": "Alice", ... }
"""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from utils import ok, created, bad_request, require_write

PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
parts_table = dynamodb.Table(PARTS_TABLE)

VALID_GROUPS = ["suspension", "drivetrain", "engine", "body", "electrical", "brakes", "other"]
VALID_LOCATIONS = [
    "front_right", "front_left", "rear_right", "rear_left",
    "front_center", "rear_center", "center_center",
]


@require_write
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    car_id = (event.get("pathParameters") or {}).get("car_id")
    if not car_id:
        return bad_request("car_id path parameter is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    # Validate required fields
    for field in ("part_number", "part_name", "part_group", "part_location"):
        if not body.get(field, "").strip():
            return bad_request(f"{field} is required")

    if body["part_group"] not in VALID_GROUPS:
        return bad_request(f"part_group must be one of: {', '.join(VALID_GROUPS)}")
    if body["part_location"] not in VALID_LOCATIONS:
        return bad_request(f"part_location must be one of: {', '.join(VALID_LOCATIONS)}")

    now = datetime.now(timezone.utc).isoformat()
    part = {
        "part_id": str(uuid.uuid4()),
        "car_id": car_id,
        "part_number": body["part_number"].strip(),
        "part_name": body["part_name"].strip(),
        "part_group": body["part_group"],
        "part_location": body["part_location"],
        "miles_used": int(body.get("miles_used", 0)),
        "active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": user["email"],
        # Optional standard fields
        "purchased_from": body.get("purchased_from", ""),
        "cost": body.get("cost", ""),
        # Dynamic extra fields stored as a flat map
        "extra_fields": body.get("extra_fields", {}),
    }
    parts_table.put_item(Item=part)
    return created({"part": part})
