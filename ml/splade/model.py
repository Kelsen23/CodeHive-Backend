import os

from sentence_transformers import SparseEncoder


MODEL_NAME = os.environ.get("SPLADE_MODEL", "naver/splade-v3")
MODEL = SparseEncoder(MODEL_NAME)


def encode(mode: str, texts: list[str]) -> list[dict[str, list[float] | list[int]]]:
    encoder = MODEL.encode_query if mode == "query" else MODEL.encode_document
    vectors = encoder(
        texts,
        convert_to_tensor=True,
        convert_to_sparse_tensor=True,
        show_progress_bar=False,
    )
    if len(texts) == 1:
        vectors = [vectors]
    return [vector for vector in vectors]
