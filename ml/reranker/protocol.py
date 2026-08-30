def parse_request(request: dict) -> tuple[str, list[list[str]]]:
    request_id = request.get("id")
    pairs = request.get("pairs")
    if not isinstance(request_id, str) or not request_id:
        raise ValueError("request id must be a non-empty string")
    if not isinstance(pairs, list) or not pairs:
        raise ValueError("pairs must be a non-empty list")
    for pair in pairs:
        if (
            not isinstance(pair, list)
            or len(pair) != 2
            or not all(isinstance(text, str) and text for text in pair)
        ):
            raise ValueError("each pair must contain two non-empty strings")
    return request_id, pairs
