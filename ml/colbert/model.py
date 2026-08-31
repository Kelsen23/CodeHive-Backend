import os
import sys
import tempfile
from contextlib import redirect_stdout

os.environ.setdefault(
    "TORCH_EXTENSIONS_DIR",
    os.path.join(tempfile.gettempdir(), "qanopy-colbert-torch-extensions"),
)

CHECKPOINT = os.environ.get("COLBERT_CHECKPOINT_PATH", "colbert-ir/colbertv2.0")
with redirect_stdout(sys.stderr):
    from colbert import Checkpoint
    from colbert.infra import ColBERTConfig

    MODEL = Checkpoint(CHECKPOINT, ColBERTConfig(gpus=0), verbose=0)


def encode(mode: str, texts: list[str]) -> list[list[list[float]]]:
    if mode == "query":
        result = MODEL.queryFromText(texts, bsize=8, to_cpu=True)
        vectors = result.tolist()
        trimmed = []
        for matrix in vectors:
            trimmed.append(
                [vector for vector in matrix if any(abs(value) > 0 for value in vector)]
            )
        return trimmed

    result = MODEL.docFromText(
        texts,
        bsize=8,
        keep_dims=False,
        to_cpu=False,
        showprogress=False,
    )
    matrices = result[0] if isinstance(result, tuple) else result
    return [matrix.cpu().tolist() for matrix in matrices]
