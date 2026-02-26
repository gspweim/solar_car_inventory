"""
PUT /auth/users/{user_id}
Admin only. Update a user's role or status.
Body: { "role": "admin|readonly", "status": "active|rejected" }
"""
import json
import os
import boto3
from utils import ok, bad_request, not_found, require_admin

USERS_TABLE = os.environ["USERS_TABLE"]
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)

VALID_ROLES = {"admin", "readonly"}
VALID_STATUSES = {"active", "rejected"}


@require_admin
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    target_user_id = (event.get("pathParameters") or {}).get("user_id")
    if not target_user_id:
        return bad_request("user_id path parameter is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    role = body.get("role")
    status = body.get("status")

    if role and role not in VALID_ROLES:
        return bad_request(f"role must be one of: {', '.join(VALID_ROLES)}")
    if status and status not in VALID_STATUSES:
        return bad_request(f"status must be one of: {', '.join(VALID_STATUSES)}")

    # Verify user exists
    resp = users_table.get_item(Key={"user_id": target_user_id})
    if not resp.get("Item"):
        return not_found("User not found")

    update_parts = []
    expr_values = {}

    if role:
        update_parts.append("#r = :r")
        expr_values[":r"] = role
    if status:
        update_parts.append("#s = :s")
        expr_values[":s"] = status

    if not update_parts:
        return bad_request("Nothing to update. Provide role and/or status.")

    expr_names = {}
    if role:
        expr_names["#r"] = "role"
    if status:
        expr_names["#s"] = "status"

    users_table.update_item(
        Key={"user_id": target_user_id},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )

    return ok({"message": "User updated successfully", "user_id": target_user_id})
