import path from "node:path";

import { z } from "zod";

const rerankerEnvSchema = z.object({
  RERANKER_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("cross-encoder/ms-marco-MiniLM-L-6-v2"),
  RERANKER_CHECKPOINT_PATH: z.string().trim().min(1).optional(),
  RERANKER_PYTHON_EXECUTABLE: z
    .string()
    .trim()
    .min(1)
    .default(path.resolve(".venv-reranker/bin/python")),
  RERANKER_WORKER_PATH: z
    .string()
    .trim()
    .min(1)
    .default(path.resolve("ml/reranker/worker.py")),
  RERANKER_BATCH_SIZE: z.coerce.number().int().positive().default(16),
  RERANKER_QUERY_MAX_CHARACTERS: z.coerce
    .number()
    .int()
    .positive()
    .default(12000),
  RERANKER_CANDIDATE_MAX_CHARACTERS: z.coerce
    .number()
    .int()
    .positive()
    .default(12000),
});

export { rerankerEnvSchema };
