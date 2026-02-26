"""
GET /cars/{car_id}/reports/mbf
Miles Between Failures (MBF) report.

For each part_number that has been retired due to "failure",
calculates the average miles at retirement (= miles between failures).
Also shows current active parts of that type and their current miles.
"""
import os
import boto3
from boto3.dynamodb.conditions import Key
from collections import defaultdict
from utils import ok, bad_request, require_auth

PART_HISTORY_TABLE = os.environ["PART_HISTORY_TABLE"]
PARTS_TABLE = os.environ["PARTS_TABLE"]
dynamodb = boto3.resource("dynamodb")
history_table = dynamodb.Table(PART_HISTORY_TABLE)
parts_table = dynamodb.Table(PARTS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    car_id = (event.get("pathParameters") or {}).get("car_id")
    if not car_id:
        return bad_request("car_id path parameter is required")

    # Fetch all history for this car
    resp = history_table.query(
        IndexName="car-history-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    history = resp.get("Items", [])

    # Group failures by part_number
    failures_by_part = defaultdict(list)
    for h in history:
        if h.get("reason") == "failure":
            pn = h.get("part_number", "unknown")
            miles = float(str(h.get("miles_at_retirement", 0)))
            failures_by_part[pn].append({
                "miles_at_failure": miles,
                "part_name": h.get("part_name", ""),
                "replaced_at": h.get("replaced_at", ""),
                "note": h.get("note", ""),
            })

    # Fetch active parts for context
    active_resp = parts_table.query(
        IndexName="car-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    active_parts = [p for p in active_resp.get("Items", []) if p.get("active", True)]
    active_by_pn = defaultdict(list)
    for p in active_parts:
        active_by_pn[p.get("part_number", "")].append(float(str(p.get("miles_used", 0))))

    # Build MBF report
    mbf_report = []
    for part_number, failures in failures_by_part.items():
        miles_list = [f["miles_at_failure"] for f in failures]
        avg_mbf = sum(miles_list) / len(miles_list)
        min_mbf = min(miles_list)
        max_mbf = max(miles_list)

        current_miles = active_by_pn.get(part_number, [])
        pct_of_avg = None
        if current_miles and avg_mbf > 0:
            pct_of_avg = round((max(current_miles) / avg_mbf) * 100, 1)

        mbf_report.append({
            "part_number": part_number,
            "part_name": failures[0]["part_name"],
            "failure_count": len(failures),
            "avg_miles_between_failures": round(avg_mbf, 1),
            "min_miles_at_failure": round(min_mbf, 1),
            "max_miles_at_failure": round(max_mbf, 1),
            "current_active_miles": current_miles,
            "highest_active_pct_of_avg_mbf": pct_of_avg,
            "failures": failures,
        })

    # Sort by avg MBF ascending (most concerning first)
    mbf_report.sort(key=lambda x: x["avg_miles_between_failures"])

    return ok({
        "report": "miles_between_failures",
        "car_id": car_id,
        "data": mbf_report,
        "count": len(mbf_report),
    })
