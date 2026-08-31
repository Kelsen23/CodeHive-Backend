import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import rerankerConfig from "../../../../config/reranker.config.js";

type RerankerResponse = {
  id: string;
  scores?: number[];
  error?: string;
};

type PendingRequest = {
  resolve: (response: RerankerResponse) => void;
  reject: (error: Error) => void;
};

let worker: ChildProcessWithoutNullStreams | undefined;
let reader: ReturnType<typeof createInterface> | undefined;
let requestCounter = 0;
const pending = new Map<string, PendingRequest>();

const rejectPending = (error: Error) => {
  for (const request of pending.values()) request.reject(error);

  pending.clear();
};

const stopWorker = (
  error: Error,
  expectedWorker?: ChildProcessWithoutNullStreams,
) => {
  if (expectedWorker && worker !== expectedWorker) return;

  const currentReader = reader;
  const currentWorker = worker;
  reader = undefined;
  worker = undefined;

  currentReader?.close();
  currentWorker?.kill();

  rejectPending(error);
};

const ensureWorker = () => {
  if (worker && reader) return;

  worker = spawn(rerankerConfig.pythonExecutable, [rerankerConfig.workerPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      RERANKER_CHECKPOINT_PATH: rerankerConfig.checkpointPath,
      RERANKER_BATCH_SIZE: String(rerankerConfig.batchSize),
    },
  });

  reader = createInterface({ input: worker.stdout });

  reader.on("line", (line) => {
    let response: RerankerResponse;
    try {
      response = JSON.parse(line) as RerankerResponse;
    } catch {
      stopWorker(new Error("Reranker worker returned invalid JSON"));
      return;
    }

    const request = pending.get(response.id);
    if (!request) return;

    pending.delete(response.id);
    request.resolve(response);
  });

  worker.stderr.on("data", (chunk) =>
    process.stderr.write(`[reranker] ${chunk}`),
  );

  const spawnedWorker = worker;

  worker.once("error", (error) => stopWorker(error, spawnedWorker));

  worker.once("exit", (code, signal) => {
    stopWorker(
      new Error(
        `Reranker worker exited (${signal ?? `code ${code ?? "unknown"}`})`,
      ),
      spawnedWorker,
    );
  });
};

const scoreRerankerPairs = async (pairs: Array<[string, string]>) => {
  ensureWorker();

  const id = String(requestCounter++);

  const response = await new Promise<RerankerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker?.stdin.write(`${JSON.stringify({ id, pairs })}\n`);
  });

  if (response.error)
    throw new Error(`Reranker scoring failed: ${response.error}`);

  if (!response.scores || response.scores.length !== pairs.length)
    throw new Error("Reranker worker returned an invalid score count");

  if (response.scores.some((score) => !Number.isFinite(score)))
    throw new Error("Reranker worker returned a non-finite score");

  return { scores: response.scores, model: rerankerConfig.model };
};

const closeRerankerWorker = async () => {
  const currentWorker = worker;
  if (!currentWorker) return;

  reader?.close();
  reader = undefined;

  worker = undefined;
  rejectPending(new Error("Reranker worker closed"));

  await new Promise<void>((resolve) => {
    currentWorker.once("exit", () => resolve());
    currentWorker.stdin.end();
  });
};

export { closeRerankerWorker, scoreRerankerPairs };
