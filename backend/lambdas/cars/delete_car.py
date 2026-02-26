"""
DELETE /cars/{car_id}
Admin only. Delete a car.
"""
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

    resp = cars_table.get_item(Key={"car_id": car_id})
    if not resp.get("Item"):
        return not_found("Car not found")

    cars_table.delete_item(Key={"car_id": car_id})
    return ok({"message": "Car deleted", "car_id": car_id})
