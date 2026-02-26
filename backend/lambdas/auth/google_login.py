"""
POST /auth/google
Body: { "id_token": "<google id token>" }

Verifies the Google ID token, upserts the user in DynamoDB,
and returns a signed JWT for subsequent API calls.

New users are created with role="readonly".
The first user ever is automatically made admin.
"""
import json
import os
import uuid
import urllib.request
import urllib.parse

import boto3
from boto3.dynamodb.conditions import Key

from utils import ok, bad_request, server_error, create_jwt

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
USERS_TABLE = os.environ["USERS_TABLE"]

dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)

GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def verify_google_token(id_token: str) -> dict | None:
    """Call Google's tokeninfo endpoint to verify the ID token."""
    url = f"{GOOGLE_TOKEN_INFO_URL}?id_token={urllib.parse.quote(id_token)}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read())
    except Exception:
        return None

    # Validate audience
    if data.get("aud") != GOOGLE_CLIENT_ID:
        return None
    if data.get("email_verified") != "true":
        return None
    return data


def handler(event, context):
    # Handle OPTIONS preflight
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    id_token = body.get("id_token")
    if not id_token:
        return bad_request("id_token is required")

    google_data = verify_google_token(id_token)
    if not google_data:
        return bad_request("Invalid Google ID token")

    email = google_data["email"]
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")
    google_sub = google_data["sub"]

    # Look up user by email
    resp = users_table.query(
        IndexName="email-index",
        KeyConditionExpression=Key("email").eq(email),
    )
    items = resp.get("Items", [])

    if items:
        user = items[0]
        # Update name/picture in case they changed
        users_table.update_item(
            Key={"user_id": user["user_id"]},
            UpdateExpression="SET #n = :n, picture = :p, google_sub = :g",
            ExpressionAttributeNames={"#n": "name"},
            ExpressionAttributeValues={":n": name, ":p": picture, ":g": google_sub},
        )
        user["name"] = name
        user["picture"] = picture
    else:
        # Check if this is the very first user → make them admin
        scan_resp = users_table.scan(Select="COUNT")
        is_first = scan_resp.get("Count", 0) == 0

        user = {
            "user_id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "picture": picture,
            "google_sub": google_sub,
            "role": "admin" if is_first else "readonly",
            "status": "active",
        }
        users_table.put_item(Item=user)

    if user.get("status") == "rejected":
        return {
            "statusCode": 403,
            "headers": {"Content-Type": "application/json",
                        "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*")},
            "body": json.dumps({"error": "Your account has been rejected by an admin."}),
        }

    token = create_jwt({
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    })

    return ok({
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user["picture"],
            "role": user["role"],
        },
    })
