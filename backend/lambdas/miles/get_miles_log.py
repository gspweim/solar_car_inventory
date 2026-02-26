"""
GET /cars/{car_id}/miles
Returns the miles log for a car (test sessions).
Query params:
  - limit: max records (default 50)
  - from_date: ISO date string (inclusive)
  - to_date: ISO date string (inclusive)
"""
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from utils import ok, bad_request, require_auth

MILES_LOG_TABLE = os.environ["MILES_LOG_TABLE"]
dynamodb = boto3.resource("dynamodb")
miles_table = dynamodb.Table(MILES_LOG_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    car_id = (event.get("pathParameters") or {}).get("car_id")
    if not car_id:
        return bad_request("car_id path parameter is required")

    qp = event.get("queryStringParameters") or {}
    limit = int(qp.get("limit", 50))
    from_date = qp.get("from_date")
    to_date = qp.get("to_date")

    query_kwargs = {
        "IndexName": "car-miles-index",
        "KeyConditionExpression": Key("car_id").eq(car_id),
        "ScanIndexForward": False,
        "Limit": limit,
    }

    if from_date and to_date:
        query_kwargs["KeyConditionExpression"] = (
            Key("car_id").eq(car_id) & Key("logged_at").between(from_date, to_date + "T23:59:59Z")
        )
    elif from_date:
        query_kwargs["KeyConditionExpression"] = (
            Key("car_id").eq(car_id) & Key("logged_at").gte(from_date)
        )

    resp = miles_table.query(**query_kwargs)
    items = resp.get("Items", [])

    # Convert miles string back to float for the response
    for item in items:
        try:
            item["miles"] = float(item["miles"])
        except (TypeError, ValueError):
            pass

    total_miles = sum(item.get("miles", 0) for item in items if isinstance(item.get("miles"), float))

    return ok({
        "log": items,
        "count": len(items),
        "total_miles_shown": round(total_miles, 2),
    })
