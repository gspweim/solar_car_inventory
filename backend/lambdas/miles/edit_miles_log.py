"""
PUT /cars/{car_id}/miles/{log_id}
Write access required.

Edit the most recent test session for a car.
- Only the most recent log entry (by logged_at) may be edited.
- If any part has been added or removed (via replace/retire/create) since the
  log entry was created, the edit is blocked to prevent data inconsistency.
- Editing the miles applies a delta to all currently active parts.
- Editing the note or test_date is always allowed (no delta needed).

Body:
{
  "miles": 11.5,          // optional – new miles value
  "note": "updated note", // optional
  "test_date": "2024-03-15" // optional
}
"""
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key
from utils import ok, bad_request, not_found, forbidden, require_write

MILES_LOG_TABLE = os.environ["MILES_LOG_TABLE"]
PARTS_TABLE = os.environ["PARTS_TABLE"]
PART_HISTORY_TABLE = os.environ["PART_HISTORY_TABLE"]

dynamodb = boto3.resource("dynamodb")
miles_table = dynamodb.Table(MILES_LOG_TABLE)
parts_table = dynamodb.Table(PARTS_TABLE)
history_table = dynamodb.Table(PART_HISTORY_TABLE)


@require_write
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    path = event.get("pathParameters") or {}
    car_id = path.get("car_id")
    log_id = path.get("log_id")

    if not car_id or not log_id:
        return bad_request("car_id and log_id path parameters are required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    # ── 1. Fetch the log entry ────────────────────────────────────────────────
    resp = miles_table.get_item(Key={"log_id": log_id})
    log_entry = resp.get("Item")
    if not log_entry:
        return not_found("Miles log entry not found")
    if log_entry.get("car_id") != car_id:
        return forbidden("Log entry does not belong to this car")

    # ── 2. Verify this is the most recent log entry for the car ───────────────
    recent_resp = miles_table.query(
        IndexName="car-miles-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
        ScanIndexForward=False,
        Limit=1,
    )
    recent_items = recent_resp.get("Items", [])
    if not recent_items or recent_items[0]["log_id"] != log_id:
        return bad_request(
            "Only the most recent test session can be edited. "
            "This is not the latest session for this car."
        )

    logged_at = log_entry.get("logged_at", "")

    # ── 3. Check for part changes since this log entry ────────────────────────
    # Check if any part was retired (replaced) after the log was created
    history_resp = history_table.query(
        IndexName="car-history-index",
        KeyConditionExpression=(
            Key("car_id").eq(car_id) & Key("replaced_at").gt(logged_at)
        ),
    )
    history_after = history_resp.get("Items", [])

    # Check if any new part was created after the log was created
    all_parts_resp = parts_table.query(
        IndexName="car-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    all_parts = all_parts_resp.get("Items", [])
    new_parts_after = [
        p for p in all_parts
        if p.get("created_at", "") > logged_at
    ]

    if history_after or new_parts_after:
        changed_descriptions = []
        for h in history_after:
            changed_descriptions.append(
                f"'{h.get('part_name', h.get('part_number', 'unknown'))}' was replaced/retired"
            )
        for p in new_parts_after:
            changed_descriptions.append(
                f"'{p.get('part_name', p.get('part_number', 'unknown'))}' was added"
            )
        detail = "; ".join(changed_descriptions)
        return bad_request(
            f"Cannot edit this test session because parts have changed since it was logged: {detail}. "
            "Editing miles would produce incorrect part mileage."
        )

    # ── 4. Determine what's changing ──────────────────────────────────────────
    new_miles_raw = body.get("miles")
    new_note = body.get("note")
    new_test_date = body.get("test_date")

    if new_miles_raw is None and new_note is None and new_test_date is None:
        return bad_request("Nothing to update. Provide miles, note, and/or test_date.")

    now = datetime.now(timezone.utc).isoformat()
    updates = []
    expr_names = {}
    expr_values = {":updated_at": now}
    updates.append("#updated_at = :updated_at")
    expr_names["#updated_at"] = "updated_at"

    if new_note is not None:
        updates.append("#note = :note")
        expr_names["#note"] = "note"
        expr_values[":note"] = new_note

    if new_test_date is not None:
        updates.append("#test_date = :test_date")
        expr_names["#test_date"] = "test_date"
        expr_values[":test_date"] = new_test_date

    miles_delta = Decimal("0")
    if new_miles_raw is not None:
        try:
            new_miles = float(new_miles_raw)
        except (TypeError, ValueError):
            return bad_request("miles must be a number")
        if new_miles <= 0:
            return bad_request("miles must be greater than 0")

        old_miles = float(log_entry.get("miles", 0))
        miles_delta = Decimal(str(new_miles)) - Decimal(str(old_miles))

        updates.append("#miles = :miles")
        expr_names["#miles"] = "miles"
        expr_values[":miles"] = str(new_miles)  # stored as string like original

    # ── 5. Update the log entry ───────────────────────────────────────────────
    miles_table.update_item(
        Key={"log_id": log_id},
        UpdateExpression="SET " + ", ".join(updates),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )

    # ── 6. Apply delta to all active parts ────────────────────────────────────
    parts_updated = 0
    if miles_delta != Decimal("0"):
        active_parts = [p for p in all_parts if p.get("active", True)]
        for part in active_parts:
            current_miles = Decimal(str(part.get("miles_used", 0)))
            new_part_miles = current_miles + miles_delta
            # Clamp to 0 to avoid negative miles
            if new_part_miles < Decimal("0"):
                new_part_miles = Decimal("0")
            parts_table.update_item(
                Key={"part_id": part["part_id"]},
                UpdateExpression="SET miles_used = :m, updated_at = :t",
                ExpressionAttributeValues={
                    ":m": new_part_miles,
                    ":t": now,
                },
            )
            parts_updated += 1

    return ok({
        "message": "Test session updated",
        "log_id": log_id,
        "miles_delta": float(miles_delta),
        "parts_updated": parts_updated,
    })
