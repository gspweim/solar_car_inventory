"""
GET /cars/{car_id}/parts
Returns all active parts for a car.
Query params:
  - group: filter by part_group
  - location: filter by part_location
"""
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from utils import ok, bad_request, require_auth

PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
parts_table = dynamodb.Table(PARTS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    car_id = (event.get("pathParameters") or {}).get("car_id")
    if not car_id:
        return bad_request("car_id path parameter is required")

    qp = event.get("queryStringParameters") or {}
    group_filter = qp.get("group")
    location_filter = qp.get("location")

    resp = parts_table.query(
        IndexName="car-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    items = resp.get("Items", [])

    # Filter out retired parts (active=False)
    items = [p for p in items if p.get("active", True)]

    if group_filter:
        items = [p for p in items if p.get("part_group") == group_filter]
    if location_filter:
        items = [p for p in items if p.get("part_location") == location_filter]

    # Sort by part_name
    items.sort(key=lambda p: p.get("part_name", "").lower())

    return ok({"parts": items, "count": len(items)})
