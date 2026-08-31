# Offline Retrieval Workers

The workers in this directory are optional benchmark tooling and are not started by the production server.

## Workers

- `splade/` provides sparse representations for SPLADE benchmark runs.
- `colbert/` provides token-level representations for ColBERT benchmark runs.
- `reranker/` provides cross-encoder scores for reranker benchmark runs.

Each worker has its own README with setup, configuration, and protocol instructions.

## Setup

Create the virtual environment required by the worker you want to run.

Install its `requirements.txt` file inside that environment.

Set the matching model, checkpoint, Python executable, and worker path variables in `.env`.

The TypeScript adapter starts the worker lazily during the selected benchmark.
