import json
import sys
import traceback

from model import encode
from protocol import parse_request, sparse_vector


def main() -> None:
    for line in sys.stdin:
        try:
            request = parse_request(json.loads(line))
            vectors = encode(request["mode"], request["texts"])
            response = {
                "id": request["id"],
                "vectors": [sparse_vector(vector) for vector in vectors],
            }
        except Exception as error:
            print(
                json.dumps(
                    {
                        "id": locals().get("request", {}).get("id"),
                        "error": str(error),
                    }
                ),
                flush=True,
            )
            traceback.print_exc(file=sys.stderr)
            continue
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
