import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import findSimilarQuestionCandidates from "../../src/services/question/similarQuestions/similarQuestionsSearch.service.js";
import type { DenseCorpusSource } from "../../src/services/question/similarQuestions/retrieval/retrieval.types.js";

import { loadRetrievalCorpus, loadRetrievalEvalDataset } from "./load.js";
import { prepareDenseEvalCorpus } from "./prepare.js";
import {
  runRetrievalEval,
  type DatasetConfig,
  type DatasetName,
  type RetrievalEvalRunnerDependencies,
} from "./runner.js";

const datasetConfigs: Record<DatasetName, DatasetConfig> = {
  dev: {
    casesPath: fileURLToPath(new URL("./cases.dev.jsonl", import.meta.url)),
    corpusPath: fileURLToPath(new URL("./corpus.v1.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/retrieval/dev/", import.meta.url),
    ),
  },
  holdout: {
    casesPath: fileURLToPath(
      new URL("./cases.holdout.v1.jsonl", import.meta.url),
    ),
    corpusPath: fileURLToPath(new URL("./corpus.v1.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/retrieval/holdout-v1/", import.meta.url),
    ),
  },
  regression: {
    casesPath: fileURLToPath(
      new URL("./cases.regression.jsonl", import.meta.url),
    ),
    corpusPath: fileURLToPath(new URL("./corpus.v1.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/retrieval/regression/", import.meta.url),
    ),
  },
};

const parseDatasetName = (args: string[]): DatasetName => {
  const datasetArgumentIndex = args.findIndex((arg) => arg === "--dataset");
  let datasetArgument: string | undefined;

  if (datasetArgumentIndex >= 0) {
    const value = args[datasetArgumentIndex + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(
        "Missing value for --dataset. Expected dev, holdout, or regression.",
      );
    }

    datasetArgument = value;
  } else {
    const inlineArgument = args.find((arg) => arg.startsWith("--dataset="));

    if (inlineArgument !== undefined) {
      datasetArgument = inlineArgument.slice(10);
    }
  }

  if (datasetArgument === "")
    throw new Error(
      "Missing value for --dataset. Expected dev, holdout, or regression.",
    );

  const dataset = datasetArgument ?? "dev";

  if (dataset === "dev" || dataset === "holdout" || dataset === "regression")
    return dataset;
  throw new Error(
    `Unsupported retrieval eval dataset: ${dataset}. Expected dev, holdout, or regression.`,
  );
};

const getGitCommit = () => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
};

let preparedCorpus: DenseCorpusSource | undefined;

const dependencies: RetrievalEvalRunnerDependencies = {
  loadCases: loadRetrievalEvalDataset,
  loadCorpus: async (filename) => {
    const corpus = await loadRetrievalCorpus(filename);
    preparedCorpus = await prepareDenseEvalCorpus(corpus);
    return corpus;
  },
  retrieve: (input) => {
    if (!preparedCorpus) {
      throw new Error("Dense eval corpus has not been prepared");
    }

    return findSimilarQuestionCandidates({
      ...input,
      corpus: preparedCorpus,
    });
  },
  now: () => performance.now(),
  getTimestamp: () => new Date().toISOString(),
  getGitCommit,
  createReportDirectory: async (directory) =>
    mkdir(directory, { recursive: true }) as Promise<void>,
  writeReport: (filename, report) =>
    writeFile(filename, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  log: (...values) => console.log(...values),
};

const run = async () => {
  const dataset = parseDatasetName(process.argv.slice(2));
  await runRetrievalEval({
    retrievalName: "dense-v1",
    dataset,
    datasetConfig: datasetConfigs[dataset],
    dependencies,
  });
};

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
