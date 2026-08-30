# ColBERT Worker

This worker converts benchmark text into token-level matrices for exact MaxSim retrieval.

It is benchmark/reference-only and is not required by the production server.

## Setup

```bash
python -m venv .venv-colbert
source .venv-colbert/bin/activate
python -m pip install -r ml/colbert/requirements.txt
```

Set `COLBERT_MODEL` to the model identifier used by the benchmark.

Set `COLBERT_CHECKPOINT_PATH` when the model requires a local checkpoint or cache path.

Set `COLBERT_PYTHON_EXECUTABLE` and `COLBERT_WORKER_PATH` when the defaults do not match your environment.

## Protocol

The worker reads one JSON object per line from `stdin`.

It writes one JSON response per request to `stdout`.

It writes diagnostics and tracebacks to `stderr` so `stdout` remains machine-readable.

The TypeScript adapter owns persistence, eligibility filtering, and exact MaxSim scoring.
