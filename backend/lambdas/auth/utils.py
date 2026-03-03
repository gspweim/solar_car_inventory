"""
Shared utilities - canonical copy used by all Lambda functions.
This file is symlinked / copied into each Lambda package at build time.
See scripts/build.sh for details.

Role hierarchy:
  admin    - full access (create, read, update, delete, manage users)
  normal   - can log tests, add/edit data, view users; cannot delete or manage users
  readonly - read-only access only
"""
import json
import os
import time
import hmac
import hashlib
import base64
from functools import wraps

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")

# Role constants
ROLE_ADMIN = "admin"
ROLE_NORMAL = "normal"
ROLE_READONLY = "readonly"

# Roles that have write access (add/edit data, log tests)
WRITE_ROLES = {ROLE_ADMIN, ROLE_NORMAL}


# ─── Response helpers ─────────────────────────────────────────────────────────

def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def ok(body: dict) -> dict:
    return response(200, body)


def created(body: dict) -> dict:
    return response(201, body)


def bad_request(msg: str) -> dict:
    return response(400, {"error": msg})


def unauthorized(msg: str = "Unauthorized") -> dict:
    return response(401, {"error": msg})


def forbidden(msg: str = "Forbidden") -> dict:
    return response(403, {"error": msg})


def not_found(msg: str = "Not found") -> dict:
    return response(404, {"error": msg})


def server_error(msg: str = "Internal server error") -> dict:
    return response(500, {"error": msg})


# ─── Minimal JWT (HS256) ──────────────────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_jwt(payload: dict, expires_in: int = 86400 * 7) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = dict(payload)
    payload["iat"] = int(time.time())
    payload["exp"] = int(time.time()) + expires_in
    body = _b64url_encode(json.dumps(payload).encode())
    sig_input = f"{header}.{body}".encode()
    sig = hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"


def verify_jwt(token: str):
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, body, sig = parts
        sig_input = f"{header}.{body}".encode()
        expected_sig = hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(sig), expected_sig):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


# ─── Auth middleware decorators ───────────────────────────────────────────────

def get_token_from_event(event: dict):
    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization") or ""
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def require_auth(func):
    """Allow any authenticated user (admin, normal, readonly)."""
    @wraps(func)
    def wrapper(event, context, **kwargs):
        token = get_token_from_event(event)
        if not token:
            return unauthorized("Missing Authorization header")
        payload = verify_jwt(token)
        if not payload:
            return unauthorized("Invalid or expired token")
        return func(event, context, user=payload, **kwargs)
    return wrapper


def require_admin(func):
    """Allow only admin users."""
    @wraps(func)
    def wrapper(event, context, **kwargs):
        token = get_token_from_event(event)
        if not token:
            return unauthorized("Missing Authorization header")
        payload = verify_jwt(token)
        if not payload:
            return unauthorized("Invalid or expired token")
        if payload.get("role") != ROLE_ADMIN:
            return forbidden("Admin access required")
        return func(event, context, user=payload, **kwargs)
    return wrapper


def require_write(func):
    """Allow admin and normal users (write access). Block readonly users."""
    @wraps(func)
    def wrapper(event, context, **kwargs):
        token = get_token_from_event(event)
        if not token:
            return unauthorized("Missing Authorization header")
        payload = verify_jwt(token)
        if not payload:
            return unauthorized("Invalid or expired token")
        if payload.get("role") not in WRITE_ROLES:
            return forbidden("Write access required. Your account is read-only.")
        return func(event, context, user=payload, **kwargs)
    return wrapper
