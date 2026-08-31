import dotenv from "dotenv";

import { colbertEnvSchema } from "../validations/config/colbert.schema.js";

dotenv.config();

const env = colbertEnvSchema.parse(process.env);

const colbertConfig = {
  model: env.COLBERT_MODEL,
  checkpointPath: env.COLBERT_CHECKPOINT_PATH ?? env.COLBERT_MODEL,
  pythonExecutable: env.COLBERT_PYTHON_EXECUTABLE,
  workerPath: env.COLBERT_WORKER_PATH,
};

export default colbertConfig;
