import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import spladeConfig from "../../../../config/splade.config.js";

type SparseVector = {
  indices: number[];
  values: number[];
};

type WorkerResponse = {
  id: string;
  vectors?: SparseVector[];
  error?: string;
};

let worker: ChildProcessWithoutNullStreams | undefined;
let responseReader: ReturnType<typeof createInterface> | undefined;
let nextRequestId = 0;
const pending = new Map<
  string,
  {
    resolve: (response: WorkerResponse) => void;
    reject: (error: Error) => void;
  }
>();

const rejectPending = (error: Error) => {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
};

const stopWorker = (
  error: Error,
  expectedWorker?: ChildProcessWithoutNullStreams,
) => {
  if (expectedWorker && worker !== expectedWorker) return;

  const currentReader = responseReader;
  const currentWorker = worker;
  responseReader = undefined;
  worker = undefined;

  currentReader?.close();
  currentWorker?.kill();
  rejectPending(error);
};

const ensureWorker = () => {
  if (worker && responseReader) return;

  const spawnedWorker = spawn(
    spladeConfig.pythonExecutable,
    [spladeConfig.workerPath],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, SPLADE_MODEL: spladeConfig.model },
    },
  );
  worker = spawnedWorker;
  responseReader = createInterface({ input: spawnedWorker.stdout });
  responseReader.on("line", (line) => {
    let response: WorkerResponse;
    try {
      response = JSON.parse(line) as WorkerResponse;
    } catch {
      stopWorker(
        new Error("SPLADE worker returned invalid JSON"),
        spawnedWorker,
      );
      return;
    }

    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    request.resolve(response);
  });
  spawnedWorker.stderr.on("data", (chunk) => {
    process.stderr.write(`[splade] ${chunk}`);
  });
  spawnedWorker.once("error", (error) => stopWorker(error, spawnedWorker));
  spawnedWorker.once("exit", (code, signal) => {
    stopWorker(
      new Error(
        `SPLADE worker exited (${signal ?? `code ${code ?? "unknown"}`})`,
      ),
      spawnedWorker,
    );
  });
};

const encodeSparseText = async (
  mode: "query" | "document",
  texts: string[],
): Promise<SparseVector[]> => {
  ensureWorker();
  const requestId = String(nextRequestId++);
  const response = await new Promise<WorkerResponse>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker?.stdin.write(`${JSON.stringify({ id: requestId, mode, texts })}\n`);
  });

  if (response.error)
    throw new Error(`SPLADE encoding failed: ${response.error}`);
  if (!response.vectors) throw new Error("SPLADE worker returned no vectors");
  return response.vectors;
};

const closeSparseEmbeddingWorker = async () => {
  const currentWorker = worker;
  if (!currentWorker) return;

  responseReader?.close();
  responseReader = undefined;
  worker = undefined;
  rejectPending(new Error("SPLADE worker closed"));

  await new Promise<void>((resolve) => {
    currentWorker.once("exit", () => resolve());
    currentWorker.stdin.end();
  });
};

export { closeSparseEmbeddingWorker, encodeSparseText, type SparseVector };
