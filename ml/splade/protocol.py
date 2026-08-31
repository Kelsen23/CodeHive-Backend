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


def sparse_vector(value: Any) -> dict[str, list[float] | list[int]]:
    if hasattr(value, "to_dense"):
        value = value.to_dense()
    if hasattr(value, "detach"):
        value = value.detach().cpu()
    if hasattr(value, "tolist"):
        value = value.tolist()

    if isinstance(value, list) and value and isinstance(value[0], list):
        value = value[0]
    if not isinstance(value, list):
        raise ValueError("Model returned an unsupported sparse vector")

    indices: list[int] = []
    values: list[float] = []
    for index, item in enumerate(value):
        number = float(item)
        if number != 0.0:
            indices.append(index)
            values.append(number)
    return {"indices": indices, "values": values}
