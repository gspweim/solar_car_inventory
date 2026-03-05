"""
PUT /cars/{car_id}/parts/{part_id}
Write access required. Update any part fields.
Body can include any combination of:
  part_number, part_name, part_group, part_location,
  miles_used, purchased_from, cost, extra_fields (merged)
Admin-only fields:
  start_date, end_date
"""
import json
import os
from datetime import datetime, timezone
import boto3
from utils import ok, bad_request, not_found, forbidden, require_write, ROLE_ADMIN

PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
parts_table = dynamodb.Table(PARTS_TABLE)

VALID_GROUPS = ["suspension", "drivetrain", "engine", "body", "electrical", "brakes", "other"]
VALID_LOCATIONS = [
    "front_right", "front_left", "rear_right", "rear_left",
    "front_center", "rear_center", "center_center",
]
UPDATABLE_FIELDS = [
    "part_number", "part_name", "part_group", "part_location",
    "miles_used", "purchased_from", "cost",
]
ADMIN_ONLY_FIELDS = ["start_date", "end_date"]


@require_write
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    path = event.get("pathParameters") or {}
    car_id = path.get("car_id")
    part_id = path.get("part_id")

    if not car_id or not part_id:
        return bad_request("car_id and part_id path parameters are required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    # Verify part exists and belongs to this car
    resp = parts_table.get_item(Key={"part_id": part_id})
    item = resp.get("Item")
    if not item:
        return not_found("Part not found")
    if item.get("car_id") != car_id:
        return forbidden("Part does not belong to this car")

    # Validate enum fields if provided
    if "part_group" in body and body["part_group"] not in VALID_GROUPS:
        return bad_request(f"part_group must be one of: {', '.join(VALID_GROUPS)}")
    if "part_location" in body and body["part_location"] not in VALID_LOCATIONS:
        return bad_request(f"part_location must be one of: {', '.join(VALID_LOCATIONS)}")

    # Check if admin-only fields are being set by non-admin
    is_admin = user.get("role") == ROLE_ADMIN
    for field in ADMIN_ONLY_FIELDS:
        if field in body and not is_admin:
            return forbidden(f"Only admins can edit {field}")

    updates = []
    expr_values = {}
    expr_names = {}

    for field in UPDATABLE_FIELDS:
        if field in body:
            key = f"#{field}"
            val = f":v_{field}"
            updates.append(f"{key} = {val}")
            expr_names[key] = field
            value = body[field]
            if field == "miles_used":
                from decimal import Decimal
                value = Decimal(str(float(value)))
            expr_values[val] = value

    # Admin-only date fields
    for field in ADMIN_ONLY_FIELDS:
        if field in body and is_admin:
            key = f"#{field}"
            val = f":v_{field}"
            updates.append(f"{key} = {val}")
            expr_names[key] = field
            # Allow clearing end_date by passing null/empty string
            field_val = body[field]
            if field == "end_date" and not field_val:
                # Use REMOVE expression instead
                pass
            else:
                expr_values[val] = field_val

    # Handle clearing end_date (set to null means remove the attribute)
    remove_parts = []
    if "end_date" in body and is_admin and not body["end_date"]:
        remove_parts.append("#end_date")
        expr_names["#end_date"] = "end_date"

    # Merge extra_fields
    if "extra_fields" in body and isinstance(body["extra_fields"], dict):
        existing_extra = item.get("extra_fields", {})
        merged = {**existing_extra, **body["extra_fields"]}
        updates.append("#extra_fields = :extra_fields")
        expr_names["#extra_fields"] = "extra_fields"
        expr_values[":extra_fields"] = merged

    if not updates and not remove_parts:
        return bad_request("Nothing to update")

    updates.append("#updated_at = :updated_at")
    expr_names["#updated_at"] = "updated_at"
    expr_values[":updated_at"] = datetime.now(timezone.utc).isoformat()

    update_expr = "SET " + ", ".join(updates)
    if remove_parts:
        update_expr += " REMOVE " + ", ".join(remove_parts)

    parts_table.update_item(
        Key={"part_id": part_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )
    return ok({"message": "Part updated", "part_id": part_id})
