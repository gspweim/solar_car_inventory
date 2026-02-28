"""
GET /cars
Returns all cars in the system.
"""
import os
import sys
import boto3

sys.path.insert(0, "/opt/python")
sys.path.insert(0, "/var/task")

# Allow importing utils from the auth layer or same package
import importlib, importlib.util, pathlib

#_utils_path = pathlib.Path(__file__).parent.parent / "auth" / "utils.py"
#_spec = importlib.util.spec_from_file_location("utils", _utils_path)
#_utils = importlib.util.module_from_spec(_spec)
#_spec.loader.exec_module(_utils)
#ok = _utils.ok
#require_auth = _utils.require_auth
from utils import ok, require_auth

CARS_TABLE = os.environ["CARS_TABLE"]
dynamodb = boto3.resource("dynamodb")
cars_table = dynamodb.Table(CARS_TABLE)


@require_auth
def handler(event, context, user=None):
    if event.get("httpMethod") == "OPTIONS":
        return ok({})

    resp = cars_table.scan()
    cars = resp.get("Items", [])
    return ok({"cars": cars})
