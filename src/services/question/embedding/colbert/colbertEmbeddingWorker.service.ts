import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import colbertConfig from "../../../../config/colbert.config.js";

type ColbertResponse = {
  id: string;
  vectors?: number[][][];
  dimensions?: number;
  tokenCounts?: number[];
  error?: string;
};

let worker: ChildProcessWithoutNullStreams | undefined;
let responseReader: ReturnType<typeof createInterface> | undefined;
let nextRequestId = 0;
const pending = new Map<
  string,
  {
    resolve: (response: ColbertResponse) => void;
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
    colbertConfig.pythonExecutable,
    [colbertConfig.workerPath],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        COLBERT_CHECKPOINT_PATH: colbertConfig.checkpointPath,
      },
    },
  );
  worker = spawnedWorker;
  responseReader = createInterface({ input: spawnedWorker.stdout });
  responseReader.on("line", (line) => {
    let response: ColbertResponse;
    try {
      response = JSON.parse(line) as ColbertResponse;
    } catch {
      stopWorker(
        new Error("ColBERT worker returned invalid JSON"),
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
    process.stderr.write(`[colbert] ${chunk}`);
  });

  spawnedWorker.once("error", (error) => stopWorker(error, spawnedWorker));
  spawnedWorker.once("exit", (code, signal) => {
    stopWorker(
      new Error(
        `ColBERT worker exited (${signal ?? `code ${code ?? "unknown"}`})`,
      ),
      spawnedWorker,
    );
  });
};

const encodeColbertText = async (
  mode: "query" | "document",
  texts: string[],
) => {
  ensureWorker();
  const requestId = String(nextRequestId++);
  const response = await new Promise<ColbertResponse>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker?.stdin.write(`${JSON.stringify({ id: requestId, mode, texts })}\n`);
  });

  if (response.error)
    throw new Error(`ColBERT encoding failed: ${response.error}`);
  if (!response.vectors || !response.dimensions || !response.tokenCounts)
    throw new Error("ColBERT worker returned incomplete vectors");
  return response;
};

const closeColbertEmbeddingWorker = async () => {
  const currentWorker = worker;
  if (!currentWorker) return;

  responseReader?.close();
  responseReader = undefined;
  worker = undefined;
  rejectPending(new Error("ColBERT worker closed"));
  await new Promise<void>((resolve) => {
    currentWorker.once("exit", () => resolve());
    currentWorker.stdin.end();
  });
};

export { closeColbertEmbeddingWorker, encodeColbertText };
