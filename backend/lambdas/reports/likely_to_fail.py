"""
GET /cars/{car_id}/reports/likely-to-fail
"Likely to Fail Soon" report.

For each active part, compares its current miles_used against the
average miles-between-failures for that part_number.
Parts with no failure history are shown with a risk_score of 0.

Returns parts sorted by risk_score descending (most at-risk first).
risk_score = current_miles / avg_mbf  (1.0 = at average failure point, >1.0 = overdue)
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

    # Fetch all failure history for this car
    resp = history_table.query(
        IndexName="car-history-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    history = resp.get("Items", [])

    # Build avg MBF per part_number (failures only)
    failure_miles_by_pn = defaultdict(list)
    for h in history:
        if h.get("reason") == "failure":
            pn = h.get("part_number", "")
            if pn:
                failure_miles_by_pn[pn].append(float(str(h.get("miles_at_retirement", 0))))

    avg_mbf_by_pn = {
        pn: sum(miles) / len(miles)
        for pn, miles in failure_miles_by_pn.items()
    }

    # Fetch active parts
    active_resp = parts_table.query(
        IndexName="car-index",
        KeyConditionExpression=Key("car_id").eq(car_id),
    )
    active_parts = [p for p in active_resp.get("Items", []) if p.get("active", True)]

    result = []
    for part in active_parts:
        pn = part.get("part_number", "")
        current_miles = float(str(part.get("miles_used", 0)))
        avg_mbf = avg_mbf_by_pn.get(pn)

        if avg_mbf and avg_mbf > 0:
            risk_score = round(current_miles / avg_mbf, 3)
            risk_label = (
                "CRITICAL" if risk_score >= 1.0 else
                "HIGH" if risk_score >= 0.8 else
                "MEDIUM" if risk_score >= 0.5 else
                "LOW"
            )
        else:
            risk_score = 0.0
            risk_label = "UNKNOWN"

        result.append({
            "part_id": part["part_id"],
            "part_number": pn,
            "part_name": part.get("part_name", ""),
            "part_group": part.get("part_group", ""),
            "part_location": part.get("part_location", ""),
            "current_miles": current_miles,
            "avg_mbf": round(avg_mbf, 1) if avg_mbf else None,
            "risk_score": risk_score,
            "risk_label": risk_label,
            "failure_history_count": len(failure_miles_by_pn.get(pn, [])),
        })

    # Sort: CRITICAL first, then by risk_score desc
    risk_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4}
    result.sort(key=lambda x: (risk_order[x["risk_label"]], -x["risk_score"]))

    return ok({
        "report": "likely_to_fail",
        "car_id": car_id,
        "parts": result,
        "count": len(result),
    })
