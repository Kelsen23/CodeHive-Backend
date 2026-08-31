import json
import sys
import traceback

from model import score
from protocol import parse_request


def main() -> None:
    for line in sys.stdin:
        request_id = None
        try:
            request_id, pairs = parse_request(json.loads(line))
            response = {"id": request_id, "scores": score(pairs)}
        except Exception as error:
            response = {"id": request_id, "error": str(error)}
            traceback.print_exc(file=sys.stderr)
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
