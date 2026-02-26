"""
POST /cars/{car_id}/upload
Write access required.
Upload a spreadsheet (xlsx or csv) to bulk-import parts.

The request body should be base64-encoded file content with header:
  Content-Type: application/json
  Body: {
    "filename": "parts.xlsx",
    "content": "<base64 encoded file>"
  }

Expected columns (case-insensitive, spaces/underscores interchangeable):
  Required: part_number, part_name, part_group, part_location
  Optional: miles_used, purchased_from, cost, + any extra columns become extra_fields

Returns a summary of imported, skipped, and errored rows.
"""
import base64
import io
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from utils import ok, bad_request, server_error, require_write

PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
parts_table = dynamodb.Table(PARTS_TABLE)

VALID_GROUPS = ["suspension", "drivetrain", "engine", "body", "electrical", "brakes", "other"]
VALID_LOCATIONS = [
    "front_right", "front_left", "rear_right", "rear_left",
    "front_center", "rear_center", "center_center",
]
STANDARD_FIELDS = {"part_number", "part_name", "part_group", "part_location",
                   "miles_used", "purchased_from", "cost"}


def normalize_key(k: str) -> str:
    return k.strip().lower().replace(" ", "_").replace("-", "_")


def parse_xlsx(content: bytes) -> list[dict]:
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("openpyxl is not installed")

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [normalize_key(str(h)) if h is not None else "" for h in rows[0]]
    result = []
    for row in rows[1:]:
        if all(v is None for v in row):
            continue
        result.append({headers[i]: (str(v).strip() if v is not None else "") for i, v in enumerate(row)})
    return result


def parse_csv(content: bytes) -> list[dict]:
    import csv
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return [{normalize_key(k): (v.strip() if v else "") for k, v in row.items()} for row in reader]


@require_write
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    car_id = (event.get("pathParameters") or {}).get("car_id")
    if not car_id:
        return bad_request("car_id path parameter is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    filename = body.get("filename", "").lower()
    content_b64 = body.get("content", "")

    if not filename:
        return bad_request("filename is required")
    if not content_b64:
        return bad_request("content (base64) is required")

    try:
        file_bytes = base64.b64decode(content_b64)
    except Exception:
        return bad_request("content must be valid base64")

    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            rows = parse_xlsx(file_bytes)
        elif filename.endswith(".csv"):
            rows = parse_csv(file_bytes)
        else:
            return bad_request("Only .xlsx and .csv files are supported")
    except Exception as e:
        return bad_request(f"Failed to parse file: {str(e)}")

    if not rows:
        return bad_request("File is empty or has no data rows")

    imported = []
    skipped = []
    errors = []
    now = datetime.now(timezone.utc).isoformat()

    for i, row in enumerate(rows, start=2):  # row 1 = header
        row_num = i
        part_number = row.get("part_number", "").strip()
        part_name = row.get("part_name", "").strip()
        part_group = row.get("part_group", "").strip().lower()
        part_location = row.get("part_location", "").strip().lower()

        if not part_number or not part_name:
            skipped.append({"row": row_num, "reason": "Missing part_number or part_name"})
            continue

        if part_group not in VALID_GROUPS:
            errors.append({"row": row_num, "part_number": part_number,
                           "reason": f"Invalid part_group '{part_group}'"})
            continue

        if part_location not in VALID_LOCATIONS:
            errors.append({"row": row_num, "part_number": part_number,
                           "reason": f"Invalid part_location '{part_location}'"})
            continue

        try:
            miles_used = float(row.get("miles_used", 0) or 0)
        except (TypeError, ValueError):
            miles_used = 0.0

        # Extra fields = any column not in STANDARD_FIELDS
        extra_fields = {
            k: v for k, v in row.items()
            if k not in STANDARD_FIELDS and k and v
        }

        part = {
            "part_id": str(uuid.uuid4()),
            "car_id": car_id,
            "part_number": part_number,
            "part_name": part_name,
            "part_group": part_group,
            "part_location": part_location,
            "miles_used": miles_used,
            "active": True,
            "created_at": now,
            "updated_at": now,
            "created_by": user["email"],
            "purchased_from": row.get("purchased_from", ""),
            "cost": row.get("cost", ""),
            "extra_fields": extra_fields,
        }
        parts_table.put_item(Item=part)
        imported.append({"row": row_num, "part_number": part_number, "part_name": part_name})

    return ok({
        "message": f"Import complete: {len(imported)} imported, {len(skipped)} skipped, {len(errors)} errors",
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    })
