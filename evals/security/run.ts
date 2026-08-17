import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { verifyQuestionSecurityWithMetadata } from "../../src/services/question/ai/securityVerifier.service.js";

import { llmGatewayConfig } from "../../src/config/llmGateway.config.js";

import { loadSecurityEvalCases } from "./load.js";
import {
  runSecurityEval,
  type DatasetConfig,
  type DatasetName,
  type SecurityEvalRunnerDependencies,
} from "./runner.js";

const datasetConfigs: Record<DatasetName, DatasetConfig> = {
  dev: {
    path: fileURLToPath(new URL("./cases.dev.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/security/dev/", import.meta.url),
    ),
  },
  holdout: {
    path: fileURLToPath(new URL("./cases.holdout.v1.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/security/holdout-v1/", import.meta.url),
    ),
  },
  regression: {
    path: fileURLToPath(new URL("./cases.regression.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/security/regression/", import.meta.url),
    ),
  },
};

const parseDatasetName = (args: string[]): DatasetName => {
  const datasetArgumentIndex = args.findIndex((arg) => arg === "--dataset");
  const datasetArgument =
    datasetArgumentIndex >= 0
      ? args[datasetArgumentIndex + 1]
      : args.find((arg) => arg.startsWith("--dataset="))?.slice(10);
  const dataset = datasetArgument ?? "dev";

  if (dataset === "dev" || dataset === "holdout" || dataset === "regression") {
    return dataset;
  }

  throw new Error(
    `Unsupported security eval dataset: ${dataset}. Expected dev, holdout, or regression.`,
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

const dependencies: SecurityEvalRunnerDependencies = {
  loadCases: loadSecurityEvalCases,
  verifySecurity: verifyQuestionSecurityWithMetadata,
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

  await runSecurityEval({
    dataset,
    datasetConfig: datasetConfigs[dataset],
    dependencies,
    provider: llmGatewayConfig.routes.securityVerifier.primary.provider,
    model: llmGatewayConfig.routes.securityVerifier.primary.model,
  });
};

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
