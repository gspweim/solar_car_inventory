"""
POST /cars/{car_id}/miles
Write access required.
Log a test session's miles. Increments miles_used on ALL active parts for the car.

Body:
{
  "miles": 12.5,
  "note": "Morning test session on track",
  "test_date": "2024-03-15",   // optional, defaults to today UTC
  "laps": 10,                  // optional
  "miles_per_lap": 1.25        // optional
}
"""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from boto3.dynamodb.conditions import Key
from utils import ok, bad_request, require_write

MILES_LOG_TABLE = os.environ["MILES_LOG_TABLE"]
PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
miles_table = dynamodb.Table(MILES_LOG_TABLE)
parts_table = dynamodb.Table(PARTS_TABLE)


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

    miles = body.get("miles")
    if miles is None:
        return bad_request("miles is required")
    try:
        miles = float(miles)
    except (TypeError, ValueError):
        return bad_request("miles must be a number")
    if miles <= 0:
        return bad_request("miles must be greater than 0")

    note = body.get("note", "")
    test_date = body.get("test_date", datetime.now(timezone.utc).date().isoformat())
    now = datetime.now(timezone.utc).isoformat()

    # Optional laps and miles_per_lap
    laps = body.get("laps")
    miles_per_lap = body.get("miles_per_lap")

    # 1. Write the miles log entry
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "car_id": car_id,
        "miles": str(miles),  # DynamoDB Decimal-safe as string; convert on read
        "note": note,
        "test_date": test_date,
        "logged_at": now,
        "logged_by": user["email"],
    }
    if laps is not None:
        try:
            log_entry["laps"] = int(laps)
        except (TypeError, ValueError):
            return bad_request("laps must be an integer")
    if miles_per_lap is not None:
        try:
            log_entry["miles_per_lap"] = str(float(miles_per_lap))
        except (TypeError, ValueError):
            return bad_request("miles_per_lap must be a number")

    miles_table.put_item(Item=log_entry)

    # 2. Fetch all active parts for this car
    resp = parts_table.query(
        IndexName="car-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    active_parts = [p for p in resp.get("Items", []) if p.get("active", True)]

    # 3. Increment miles_used on each active part
    from decimal import Decimal
    miles_decimal = Decimal(str(miles))

    for part in active_parts:
        current_miles = Decimal(str(part.get("miles_used", 0)))
        new_miles = current_miles + miles_decimal
        parts_table.update_item(
            Key={"part_id": part["part_id"]},
            UpdateExpression="SET miles_used = :m, updated_at = :t",
            ExpressionAttributeValues={
                ":m": new_miles,
                ":t": now,
            },
        )

    # Convert miles_per_lap back to float for response
    response_entry = dict(log_entry)
    try:
        response_entry["miles"] = float(response_entry["miles"])
    except (TypeError, ValueError):
        pass
    if "miles_per_lap" in response_entry:
        try:
            response_entry["miles_per_lap"] = float(response_entry["miles_per_lap"])
        except (TypeError, ValueError):
            pass

    return ok({
        "message": f"Logged {miles} miles for {len(active_parts)} active parts",
        "log": response_entry,
        "parts_updated": len(active_parts),
    })
