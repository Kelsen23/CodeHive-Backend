import path from "node:path";

import { z } from "zod";

const colbertEnvSchema = z.object({
  COLBERT_MODEL: z.string().trim().min(1).default("colbert-ir/colbertv2.0"),
  COLBERT_CHECKPOINT_PATH: z.string().trim().min(1).optional(),
  COLBERT_PYTHON_EXECUTABLE: z
    .string()
    .trim()
    .min(1)
    .default(path.resolve(".venv-colbert/bin/python")),
  COLBERT_WORKER_PATH: z
    .string()
    .trim()
    .min(1)
    .default(path.resolve("ml/colbert/worker.py")),
});

export { colbertEnvSchema };
