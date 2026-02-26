"""
GET /auth/users
Admin only. Returns all users in the system.
"""
import os
import boto3
from utils import ok, require_admin

USERS_TABLE = os.environ["USERS_TABLE"]
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)


@require_admin
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    resp = users_table.scan()
    items = resp.get("Items", [])

    # Strip sensitive fields
    users = [
        {
            "user_id": u["user_id"],
            "email": u["email"],
            "name": u.get("name", ""),
            "picture": u.get("picture", ""),
            "role": u.get("role", "readonly"),
            "status": u.get("status", "active"),
        }
        for u in items
    ]

    return ok({"users": users})
