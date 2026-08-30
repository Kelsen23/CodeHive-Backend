import dotenv from "dotenv";

import { spladeEnvSchema } from "../validations/config/splade.schema.js";

dotenv.config();

const env = spladeEnvSchema.parse(process.env);

const spladeConfig = {
  model: env.SPLADE_MODEL,
  pythonExecutable: env.SPLADE_PYTHON_EXECUTABLE,
  workerPath: env.SPLADE_WORKER_PATH,
};

export default spladeConfig;
