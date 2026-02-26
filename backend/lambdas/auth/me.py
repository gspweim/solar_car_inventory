"""
GET /auth/me
Returns the current user's profile from DynamoDB.
"""
import os
import boto3
from utils import ok, not_found, require_auth

USERS_TABLE = os.environ["USERS_TABLE"]
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    resp = users_table.get_item(Key={"user_id": user["user_id"]})
    item = resp.get("Item")
    if not item:
        return not_found("User not found")

    return ok({
        "user_id": item["user_id"],
        "email": item["email"],
        "name": item.get("name", ""),
        "picture": item.get("picture", ""),
        "role": item.get("role", "readonly"),
        "status": item.get("status", "active"),
    })
