from typing import Any


def parse_request(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("Request must be a JSON object")

    request_id = value.get("id")
    mode = value.get("mode")
    texts = value.get("texts")

    if not isinstance(request_id, str) or not request_id:
        raise ValueError("Request id must be a non-empty string")
    if mode not in {"query", "document"}:
        raise ValueError("Request mode must be query or document")
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise ValueError("Request texts must be an array of strings")

    return {"id": request_id, "mode": mode, "texts": texts}


def tensor_to_vectors(value: Any) -> list[list[list[float]]]:
    if hasattr(value, "detach"):
        value = value.detach().cpu()
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, list):
        raise ValueError("Model returned an unsupported multivector result")

    if value and isinstance(value[0], list) and value[0] and isinstance(value[0][0], (int, float)):
        value = [value]

    vectors: list[list[list[float]]] = []
    for matrix in value:
        if not isinstance(matrix, list) or not matrix:
            raise ValueError("Model returned an empty token matrix")
        normalized_matrix = []
        for vector in matrix:
            if not isinstance(vector, list) or not vector:
                raise ValueError("Model returned an invalid token vector")
            normalized = [float(number) for number in vector]
            if not all(number == number and abs(number) != float("inf") for number in normalized):
                raise ValueError("Model returned non-finite values")
            normalized_matrix.append(normalized)
        vectors.append(normalized_matrix)
    return vectors
