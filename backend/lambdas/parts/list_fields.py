"""
GET /part-fields
Returns all custom field definitions (for building dynamic form dropdowns).
"""
import os
import boto3
from utils import ok, require_auth

PART_FIELDS_TABLE = os.environ["PART_FIELDS_TABLE"]
dynamodb = boto3.resource("dynamodb")
fields_table = dynamodb.Table(PART_FIELDS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    resp = fields_table.scan()
    items = resp.get("Items", [])
    items.sort(key=lambda f: f.get("field_name", "").lower())
    return ok({"fields": items})
