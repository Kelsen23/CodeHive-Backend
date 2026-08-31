# SPLADE Worker

This worker converts benchmark text into sparse token-weight representations.

It is benchmark-only and is not required by the production server.

## Setup

```bash
python -m venv .venv-splade
source .venv-splade/bin/activate
python -m pip install -r ml/splade/requirements.txt
```

Set `SPLADE_MODEL` to the model identifier or local checkpoint you want to use.

Set `SPLADE_PYTHON_EXECUTABLE` and `SPLADE_WORKER_PATH` when the defaults do not match your environment.

## Protocol

The worker reads one JSON object per line from `stdin`.

It writes one JSON response per request to `stdout`.

It writes diagnostics and tracebacks to `stderr` so `stdout` remains machine-readable.

The TypeScript adapter owns persistence, eligibility filtering, and retrieval scoring.
