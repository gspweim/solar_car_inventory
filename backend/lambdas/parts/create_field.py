"""
POST /part-fields
Admin only. Create a new custom field definition.

Body:
{
  "field_name": "wrench_size",
  "label": "Wrench Size",
  "field_type": "text|number|dropdown",
  "options": ["10mm", "12mm", "14mm"]   // only for dropdown type
}
"""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from utils import ok, created, bad_request, require_admin

PART_FIELDS_TABLE = os.environ["PART_FIELDS_TABLE"]
dynamodb = boto3.resource("dynamodb")
fields_table = dynamodb.Table(PART_FIELDS_TABLE)

VALID_TYPES = ["text", "number", "dropdown"]


@require_admin
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    field_name = body.get("field_name", "").strip().lower().replace(" ", "_")
    label = body.get("label", "").strip()
    field_type = body.get("field_type", "text")

    if not field_name:
        return bad_request("field_name is required")
    if not label:
        return bad_request("label is required")
    if field_type not in VALID_TYPES:
        return bad_request(f"field_type must be one of: {', '.join(VALID_TYPES)}")

    options = body.get("options", [])
    if field_type == "dropdown" and not options:
        return bad_request("options array is required for dropdown field type")

    field = {
        "field_id": str(uuid.uuid4()),
        "field_name": field_name,
        "label": label,
        "field_type": field_type,
        "options": options,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["email"],
    }
    fields_table.put_item(Item=field)
    return created({"field": field})
