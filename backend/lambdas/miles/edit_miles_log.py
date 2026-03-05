"""
PUT /cars/{car_id}/miles/{log_id}
Write access required.

Edit any test session for a car (not just the most recent).
- Editing the miles applies a delta to all parts that were active at the time
  of the test (start_date <= test_date AND (end_date is null OR end_date >= test_date)).
- Editing the note, test_date, laps, or miles_per_lap is always allowed.

Body:
{
  "miles": 11.5,          // optional – new miles value
  "note": "updated note", // optional
  "test_date": "2024-03-15", // optional
  "laps": 10,             // optional
  "miles_per_lap": 1.15   // optional
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


def part_was_active_on_date(part, test_date):
    """
    Returns True if the part was active (on the car) on the given test_date.
    Uses start_date and end_date fields. Falls back to always-active if no dates set.
    """
    start_date = part.get("start_date", "")
    end_date = part.get("end_date", "")

    if start_date and test_date < start_date:
        return False
    if end_date and test_date > end_date:
        return False
    return True


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

    # ── 2. Determine what's changing ──────────────────────────────────────────
    new_miles_raw = body.get("miles")
    new_note = body.get("note")
    new_test_date = body.get("test_date")
    new_laps = body.get("laps")
    new_miles_per_lap = body.get("miles_per_lap")

    if (new_miles_raw is None and new_note is None and new_test_date is None
            and new_laps is None and new_miles_per_lap is None):
        return bad_request("Nothing to update. Provide miles, note, test_date, laps, and/or miles_per_lap.")

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

    if new_laps is not None:
        updates.append("#laps = :laps")
        expr_names["#laps"] = "laps"
        try:
            expr_values[":laps"] = int(new_laps)
        except (TypeError, ValueError):
            return bad_request("laps must be an integer")

    if new_miles_per_lap is not None:
        updates.append("#miles_per_lap = :miles_per_lap")
        expr_names["#miles_per_lap"] = "miles_per_lap"
        try:
            expr_values[":miles_per_lap"] = str(float(new_miles_per_lap))
        except (TypeError, ValueError):
            return bad_request("miles_per_lap must be a number")

    miles_delta = Decimal("0")
    test_date_for_delta = new_test_date or log_entry.get("test_date", "")

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

    # ── 3. Update the log entry ───────────────────────────────────────────────
    miles_table.update_item(
        Key={"log_id": log_id},
        UpdateExpression="SET " + ", ".join(updates),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )

    # ── 4. Apply delta to parts active at the test date ───────────────────────
    parts_updated = 0
    if miles_delta != Decimal("0"):
        # Fetch ALL parts for this car (active and retired) to check date ranges
        all_parts_resp = parts_table.query(
            IndexName="car-index",
            KeyConditionExpression=Key("car_id").eq(car_id),
        )
        all_parts = all_parts_resp.get("Items", [])

        for part in all_parts:
            if not part_was_active_on_date(part, test_date_for_delta):
                continue
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
