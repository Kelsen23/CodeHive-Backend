import dotenv from "dotenv";

import { rerankerEnvSchema } from "../validations/config/reranker.schema.js";

dotenv.config();

const env = rerankerEnvSchema.parse(process.env);

const rerankerConfig = {
  model: env.RERANKER_MODEL,
  checkpointPath: env.RERANKER_CHECKPOINT_PATH ?? env.RERANKER_MODEL,
  pythonExecutable: env.RERANKER_PYTHON_EXECUTABLE,
  workerPath: env.RERANKER_WORKER_PATH,
  batchSize: env.RERANKER_BATCH_SIZE,
  queryMaxCharacters: env.RERANKER_QUERY_MAX_CHARACTERS,
  candidateMaxCharacters: env.RERANKER_CANDIDATE_MAX_CHARACTERS,
};

export default rerankerConfig;
