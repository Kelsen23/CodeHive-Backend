import path from "node:path";

import { z } from "zod";

const spladeEnvSchema = z.object({
  SPLADE_MODEL: z.string().trim().min(1).default("naver/splade-v3"),
  SPLADE_PYTHON_EXECUTABLE: z
    .string()
    .trim()
    .min(1)
    .default(path.resolve(".venv-splade/bin/python")),
  SPLADE_WORKER_PATH: z
    .string()
    .trim()
    .min(1)
    .default(path.resolve("ml/splade/worker.py")),
});

export { spladeEnvSchema };
