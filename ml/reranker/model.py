import os
import sys
from contextlib import redirect_stdout
from math import isfinite

CHECKPOINT = os.environ.get(
    "RERANKER_CHECKPOINT_PATH", "cross-encoder/ms-marco-MiniLM-L-6-v2"
)
BATCH_SIZE = int(os.environ.get("RERANKER_BATCH_SIZE", "16"))

with redirect_stdout(sys.stderr):
    from sentence_transformers import CrossEncoder

    MODEL = CrossEncoder(CHECKPOINT)


def score(pairs: list[list[str]]) -> list[float]:
    values = MODEL.predict(
        pairs, batch_size=BATCH_SIZE, show_progress_bar=False, convert_to_numpy=True
    )
    scores = [float(value) for value in values]
    if not scores or any(
        not isinstance(value, float) or not isfinite(value) for value in scores
    ):
        raise ValueError("cross-encoder returned invalid scores")
    return scores
