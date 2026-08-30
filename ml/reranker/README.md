# Cross-Encoder Reranker Worker

This worker scores query and candidate text pairs in batches for offline reranker benchmarks.

It is benchmark-only and is not required by the production server.

## Setup

```bash
python -m venv .venv-reranker
source .venv-reranker/bin/activate
python -m pip install -r ml/reranker/requirements.txt
```

Set `RERANKER_MODEL` to the model identifier used by the benchmark.

Set `RERANKER_CHECKPOINT_PATH` when the model requires a local checkpoint or cache path.

Set `RERANKER_PYTHON_EXECUTABLE`, `RERANKER_WORKER_PATH`, and the batch or truncation variables when the defaults do not match your environment.

## Protocol

The worker reads one JSON object per line from `stdin`.

Each request contains an `id` and a `pairs` array of query/candidate strings.

It writes one JSON response per request to `stdout`.

It writes diagnostics and tracebacks to `stderr` so `stdout` remains machine-readable.
