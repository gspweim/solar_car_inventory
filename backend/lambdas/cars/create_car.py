"""
POST /cars
Admin only. Create a new car.
Body: { "name": "Zephyr", "description": "Main race car", "year": 2024 }
"""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from utils import ok, created, bad_request, require_admin

CARS_TABLE = os.environ["CARS_TABLE"]
dynamodb = boto3.resource("dynamodb")
cars_table = dynamodb.Table(CARS_TABLE)


@require_admin
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    name = body.get("name", "").strip()
    if not name:
        return bad_request("name is required")

    car = {
        "car_id": str(uuid.uuid4()),
        "name": name,
        "description": body.get("description", ""),
        "year": body.get("year", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["email"],
    }
    cars_table.put_item(Item=car)
    return created({"car": car})
