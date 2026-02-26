"""
GET /cars/{car_id}/parts/{part_id}
Returns a single part.
"""
import os
import boto3
from utils import ok, bad_request, not_found, forbidden, require_auth

PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
parts_table = dynamodb.Table(PARTS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    path = event.get("pathParameters") or {}
    car_id = path.get("car_id")
    part_id = path.get("part_id")

    if not car_id or not part_id:
        return bad_request("car_id and part_id path parameters are required")

    resp = parts_table.get_item(Key={"part_id": part_id})
    item = resp.get("Item")
    if not item:
        return not_found("Part not found")
    if item.get("car_id") != car_id:
        return forbidden("Part does not belong to this car")

    return ok({"part": item})
