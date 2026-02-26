"""
GET /cars/{car_id}/reports/high-miles
Returns active parts sorted by miles_used descending.
Query params:
  - limit: number of parts to return (default 20)
  - group: filter by part_group
"""
import os
import boto3
from boto3.dynamodb.conditions import Key
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
    limit = int(qp.get("limit", 20))
    group_filter = qp.get("group")

    resp = parts_table.query(
        IndexName="car-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    parts = [p for p in resp.get("Items", []) if p.get("active", True)]

    if group_filter:
        parts = [p for p in parts if p.get("part_group") == group_filter]

    # Sort by miles_used descending
    parts.sort(key=lambda p: float(str(p.get("miles_used", 0))), reverse=True)
    top_parts = parts[:limit]

    return ok({
        "report": "high_miles",
        "car_id": car_id,
        "parts": top_parts,
        "count": len(top_parts),
    })
