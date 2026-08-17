import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { aiModerateContentWithMetadata } from "../../src/services/moderation/ai/aiModeration.service.js";

import { llmGatewayConfig } from "../../src/config/llmGateway.config.js";

import { loadModerationEvalCases } from "./load.js";
import {
  runModerationEval,
  type DatasetName,
  type DatasetConfig,
  type ModerationEvalRunnerDependencies,
} from "./runner.js";

const datasetConfigs: Record<DatasetName, DatasetConfig> = {
  dev: {
    path: fileURLToPath(new URL("./cases.dev.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/moderation/dev/", import.meta.url),
    ),
  },
  holdout: {
    path: fileURLToPath(new URL("./cases.holdout.v1.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/moderation/holdout-v1/", import.meta.url),
    ),
  },
  regression: {
    path: fileURLToPath(new URL("./cases.regression.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/moderation/regression/", import.meta.url),
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

  if (datasetArgument === "") {
    throw new Error(
      "Missing value for --dataset. Expected dev, holdout, or regression.",
    );
  }

  const dataset = datasetArgument ?? "dev";

  if (dataset === "dev" || dataset === "holdout" || dataset === "regression") {
    return dataset;
  }

  throw new Error(
    `Unsupported moderation eval dataset: ${dataset}. Expected dev, holdout, or regression.`,
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

const dependencies: ModerationEvalRunnerDependencies = {
  loadCases: loadModerationEvalCases,
  moderateContent: aiModerateContentWithMetadata,
  now: () => performance.now(),
  getTimestamp: () => new Date().toISOString(),
  getGitCommit,
  createReportDirectory: async (directory) => {
    await mkdir(directory, { recursive: true });
  },
  writeReport: (filename, report) =>
    writeFile(filename, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  log: (...values) => console.log(...values),
};

const run = async () => {
  const dataset = parseDatasetName(process.argv.slice(2));
  const datasetConfig = datasetConfigs[dataset];

  await runModerationEval({
    dataset,
    datasetConfig,
    dependencies,
    provider: llmGatewayConfig.routes.moderation.primary.provider,
    model: llmGatewayConfig.routes.moderation.primary.model,
  });
};

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
