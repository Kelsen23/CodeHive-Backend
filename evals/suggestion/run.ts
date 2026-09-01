import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import generateQuestionImprovementSuggestion from "../../src/services/question/ai/suggestion/questionImprovementSuggestion.service.js";
import type { QuestionEligibilityGateDiagnosis } from "../../src/services/question/ai/suggestion/questionSuggestion.shared.js";
import { llmGatewayConfig } from "../../src/config/llmGateway.config.js";
import { suggestionEvalJudgeEnvSchema } from "../../src/validations/config/llmGateway.schema.js";

import { loadSuggestionEvalCases } from "./load.js";
import {
  runSuggestionEval,
  type DatasetConfig,
  type DatasetName,
  type SuggestionEvalRunnerDependencies,
} from "./runner.js";
import { scoreSuggestionCases } from "./score.js";

const datasetConfigs: Record<DatasetName, DatasetConfig> = {
  dev: {
    path: fileURLToPath(new URL("./cases.dev.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/suggestion/dev/", import.meta.url),
    ),
  },
  holdout: {
    path: fileURLToPath(new URL("./cases.holdout.v1.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/suggestion/holdout-v1/", import.meta.url),
    ),
  },
  regression: {
    path: fileURLToPath(new URL("./cases.regression.jsonl", import.meta.url)),
    reportDirectory: fileURLToPath(
      new URL("../../.eval-results/suggestion/regression/", import.meta.url),
    ),
  },
};

const parseArgument = (args: string[], name: string) => {
  const argumentIndex = args.findIndex((arg) => arg === name);
  if (argumentIndex >= 0) {
    const value = args[argumentIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}`);
    }
    return value;
  }

  const inlineArgument = args.find((arg) => arg.startsWith(`${name}=`));
  return inlineArgument?.slice(name.length + 1);
};

const parseDatasetName = (args: string[]): DatasetName => {
  const dataset = parseArgument(args, "--dataset") ?? "dev";

  if (dataset === "dev" || dataset === "holdout" || dataset === "regression") {
    return dataset;
  }

  throw new Error(
    `Unsupported suggestion eval dataset: ${dataset}. Expected dev, holdout, or regression.`,
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

const isQuestionEligibilityGateDiagnosis = (
  value: unknown,
): value is QuestionEligibilityGateDiagnosis => {
  if (!value || typeof value !== "object") return false;

  const diagnosis = value as Record<string, unknown>;

  return (
    (diagnosis.decision === "ALLOW" ||
      diagnosis.decision === "CLARIFY" ||
      diagnosis.decision === "REJECT") &&
    (diagnosis.questionEligibilityStatus === "ALLOWED" ||
      diagnosis.questionEligibilityStatus === "CLARIFY" ||
      diagnosis.questionEligibilityStatus === "REJECTED") &&
    typeof diagnosis.userFacingReason === "string" &&
    typeof diagnosis.internalReason === "string"
  );
};

const dependencies: SuggestionEvalRunnerDependencies = {
  loadCases: loadSuggestionEvalCases,
  generateSuggestion: async (input) => {
    const execution = await generateQuestionImprovementSuggestion({
      ...input,
      eligibilityGateDiagnosis: isQuestionEligibilityGateDiagnosis(
        input.eligibilityGateDiagnosis,
      )
        ? input.eligibilityGateDiagnosis
        : undefined,
    });

    return {
      suggestion: execution.suggestion,
      routing: {
        provider: execution.metadata.provider,
        model: execution.metadata.model,
        fallbackUsed: execution.metadata.fallbackUsed,
        routedModel: execution.metadata.routedModel,
      },
    };
  },
  scoreCases: scoreSuggestionCases,
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
  const args = process.argv.slice(2);
  const dataset = parseDatasetName(args);
  const caseId = parseArgument(args, "--case-id");
  const generatorRoute = llmGatewayConfig.routes.aiSuggestion.primary;
  const judgeRoute = suggestionEvalJudgeEnvSchema.parse(process.env);

  await runSuggestionEval({
    dataset,
    datasetConfig: datasetConfigs[dataset],
    dependencies,
    provider: generatorRoute.provider,
    model: generatorRoute.model,
    judgeProvider: judgeRoute.LLM_EVALS_SUGGESTION_JUDGE_PROVIDER,
    judgeModel: judgeRoute.LLM_EVALS_SUGGESTION_JUDGE_MODEL,
    caseId,
  });
};

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
