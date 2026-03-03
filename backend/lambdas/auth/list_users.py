"""
GET /auth/users
All authenticated users can view the user list.
Admin users see full details; normal/readonly users see a read-only view.
"""
import os
import boto3
from utils import ok, require_auth

USERS_TABLE = os.environ["USERS_TABLE"]
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    resp = users_table.scan()
    items = resp.get("Items", [])

    # All roles can see the user list (name, email, role, status)
    # but only admins can modify users (enforced in update_user.py)
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
