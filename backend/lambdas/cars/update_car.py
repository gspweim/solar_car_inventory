"""
PUT /cars/{car_id}
Admin only. Update car name/description/year.
"""
import json
import os
import boto3
from utils import ok, bad_request, not_found, require_admin

CARS_TABLE = os.environ["CARS_TABLE"]
dynamodb = boto3.resource("dynamodb")
cars_table = dynamodb.Table(CARS_TABLE)


@require_admin
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

    # Verify car exists
    resp = cars_table.get_item(Key={"car_id": car_id})
    if not resp.get("Item"):
        return not_found("Car not found")

    updates = []
    expr_values = {}
    expr_names = {}

    for field in ("name", "description", "year"):
        if field in body:
            placeholder = f":v_{field}"
            updates.append(f"#{field} = {placeholder}")
            expr_names[f"#{field}"] = field
            expr_values[placeholder] = body[field]

    if not updates:
        return bad_request("Nothing to update")

    cars_table.update_item(
        Key={"car_id": car_id},
        UpdateExpression="SET " + ", ".join(updates),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )
    return ok({"message": "Car updated", "car_id": car_id})
