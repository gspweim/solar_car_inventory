"""
GET /cars/{car_id}/history
Returns the replacement history for all parts on a car.
Query params:
  - part_number: filter by part number
  - reason: filter by reason
  - limit: max records (default 100)
"""
import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import ok, bad_request, require_auth

PART_HISTORY_TABLE = os.environ["PART_HISTORY_TABLE"]
dynamodb = boto3.resource("dynamodb")
history_table = dynamodb.Table(PART_HISTORY_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    car_id = (event.get("pathParameters") or {}).get("car_id")
    if not car_id:
        return bad_request("car_id path parameter is required")

    qp = event.get("queryStringParameters") or {}
    part_number_filter = qp.get("part_number")
    reason_filter = qp.get("reason")
    limit = int(qp.get("limit", 100))

    resp = history_table.query(
        IndexName="car-history-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
        ScanIndexForward=False,  # newest first
        Limit=limit,
    )
    items = resp.get("Items", [])

    if part_number_filter:
        items = [h for h in items if h.get("part_number") == part_number_filter]
    if reason_filter:
        items = [h for h in items if h.get("reason") == reason_filter]

    return ok({"history": items, "count": len(items)})
