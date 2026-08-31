import json
import sys
import traceback

from model import encode
from protocol import parse_request, tensor_to_vectors


def main() -> None:
    for line in sys.stdin:
        request = None
        try:
            request = parse_request(json.loads(line))
            vectors = tensor_to_vectors(encode(request["mode"], request["texts"]))
            dimensions = len(vectors[0][0])
            response = {
                "id": request["id"],
                "vectors": vectors,
                "dimensions": dimensions,
                "tokenCounts": [len(matrix) for matrix in vectors],
            }
        except Exception as error:
            print(
                json.dumps(
                    {"id": request["id"] if request else None, "error": str(error)}
                ),
                flush=True,
            )
            traceback.print_exc(file=sys.stderr)
            continue
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
