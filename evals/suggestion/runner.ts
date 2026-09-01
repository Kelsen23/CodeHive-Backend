import type { LLMMetadata } from "../../src/services/llmGateway/llmGateway.types.js";

import type { SuggestionEvalCase, SuggestionEvalInput } from "./schema.js";
import {
  scoreSuggestionCases,
  type SuggestionCaseScore,
  type SuggestionScore,
} from "./score.js";

type DatasetName = "dev" | "holdout" | "regression";

type DatasetConfig = {
  path: string;
  reportDirectory: string;
};

type SuggestionEvalRouting = Pick<
  LLMMetadata,
  "provider" | "model" | "fallbackUsed" | "routedModel"
>;

type SuggestionEvalGeneration = {
  suggestion: unknown;
  routing: SuggestionEvalRouting;
};

type SuggestionEvalCaseResult = {
  caseId: string;
  description: string;
  tags: string[];
  status:
    | "PASS"
    | "QUALITY_FAILURE"
    | "EVALUATOR_FAILURE"
    | "EXECUTION_FAILURE";
  assertions: SuggestionScore["assertions"];
  expected: SuggestionEvalCase["assertions"];
  actual: unknown;
  routing?: SuggestionEvalRouting;
  evaluatorError?: string;
  executionError?: string;
  latencyMs: number;
};

type SuggestionEvalSummary = {
  totalCases: number;
  passedCases: number;
  qualityFailures: number;
  evaluatorFailures: number;
  executionFailures: number;
  qualityPassRate: number | null;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
};

type SuggestionEvalRunnerDependencies = {
  loadCases: (filename: string) => Promise<SuggestionEvalCase[]>;
  generateSuggestion: (
    input: SuggestionEvalInput,
  ) => Promise<SuggestionEvalGeneration>;
  scoreCases: typeof scoreSuggestionCases;
  now: () => number;
  getTimestamp: () => string;
  getGitCommit: () => string | undefined;
  writeReport: (filename: string, report: unknown) => Promise<void>;
  createReportDirectory: (directory: string) => Promise<void>;
  log: (...values: unknown[]) => void;
};

type RunSuggestionEvalOptions = {
  dataset: DatasetName;
  datasetConfig: DatasetConfig;
  dependencies: SuggestionEvalRunnerDependencies;
  provider: string;
  model: string;
  judgeProvider?: string;
  judgeModel?: string;
  caseId?: string;
};

const calculateRate = (numerator: number, denominator: number) =>
  denominator === 0 ? null : numerator / denominator;

const calculateMedian = (values: number[]) => {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const calculateSummary = (
  cases: SuggestionEvalCaseResult[],
): SuggestionEvalSummary => {
  const passedCases = cases.filter(({ status }) => status === "PASS").length;
  const qualityFailures = cases.filter(
    ({ status }) => status === "QUALITY_FAILURE",
  ).length;
  const evaluatorFailures = cases.filter(
    ({ status }) => status === "EVALUATOR_FAILURE",
  ).length;
  const executionFailures = cases.filter(
    ({ status }) => status === "EXECUTION_FAILURE",
  ).length;
  const successfulCases = passedCases + qualityFailures;
  const latencies = cases.map(({ latencyMs }) => latencyMs);

  return {
    totalCases: cases.length,
    passedCases,
    qualityFailures,
    evaluatorFailures,
    executionFailures,
    qualityPassRate: calculateRate(passedCases, successfulCases),
    averageLatencyMs: calculateRate(
      latencies.reduce((total, latency) => total + latency, 0),
      latencies.length,
    ),
    medianLatencyMs: calculateMedian(latencies),
  };
};

const makeExecutionFailure = (
  testCase: SuggestionEvalCase,
  error: unknown,
  latencyMs: number,
): SuggestionEvalCaseResult => ({
  caseId: testCase.id,
  description: testCase.description,
  tags: testCase.scenarioTags,
  status: "EXECUTION_FAILURE",
  assertions: [],
  expected: testCase.assertions,
  actual: null,
  executionError: error instanceof Error ? error.message : String(error),
  latencyMs,
});

const runSuggestionEval = async ({
  dataset,
  datasetConfig,
  dependencies,
  provider,
  model,
  judgeProvider,
  judgeModel,
  caseId,
}: RunSuggestionEvalOptions) => {
  const loadedCases = await dependencies.loadCases(datasetConfig.path);
  const testCases = caseId
    ? loadedCases.filter((testCase) => testCase.id === caseId)
    : loadedCases;

  if (caseId && testCases.length === 0) {
    throw new Error(`Suggestion eval case was not found: ${caseId}`);
  }

  const generatedCases: Array<{
    testCase: SuggestionEvalCase;
    suggestion: unknown;
  }> = [];
  const generationByCaseId = new Map<
    string,
    { suggestion: unknown; routing: SuggestionEvalRouting; latencyMs: number }
  >();
  const executionFailures = new Map<string, SuggestionEvalCaseResult>();

  for (const testCase of testCases) {
    const startedAt = dependencies.now();

    try {
      const execution = await dependencies.generateSuggestion(testCase.input);
      const latencyMs = dependencies.now() - startedAt;
      generatedCases.push({ testCase, suggestion: execution.suggestion });
      generationByCaseId.set(testCase.id, {
        suggestion: execution.suggestion,
        routing: execution.routing,
        latencyMs,
      });
    } catch (error) {
      executionFailures.set(
        testCase.id,
        makeExecutionFailure(testCase, error, dependencies.now() - startedAt),
      );
    }
  }

  const scores = await dependencies.scoreCases({ cases: generatedCases });
  const scoresByCaseId = new Map(
    scores.map(({ caseId, score }: SuggestionCaseScore) => [caseId, score]),
  );
  const caseResults = testCases.map((testCase) => {
    const executionFailure = executionFailures.get(testCase.id);
    if (executionFailure) return executionFailure;

    const score = scoresByCaseId.get(testCase.id);
    const generation = generationByCaseId.get(testCase.id);
    if (!score || !generation) {
      throw new Error(`Suggestion eval result was missing case ${testCase.id}`);
    }

    return {
      caseId: testCase.id,
      description: testCase.description,
      tags: testCase.scenarioTags,
      status: score.status,
      assertions: score.assertions,
      expected: testCase.assertions,
      actual: score.actual,
      routing: generation.routing,
      evaluatorError: score.evaluatorError,
      latencyMs: generation.latencyMs,
    } satisfies SuggestionEvalCaseResult;
  });

  for (const result of caseResults) {
    const marker = result.status === "PASS" ? "✓" : "✗";
    dependencies.log(`${marker} ${result.caseId} ${result.status}`);

    if (result.status === "QUALITY_FAILURE") {
      for (const assertion of result.assertions.filter(
        ({ passed }) => !passed,
      )) {
        dependencies.log(
          `  ${assertion.name}: ${assertion.message ?? `expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(assertion.actual)}`}`,
        );
      }
    }

    if (result.status === "EVALUATOR_FAILURE") {
      dependencies.log(`  ${result.evaluatorError}`);
    }

    if (result.status === "EXECUTION_FAILURE") {
      dependencies.log(`  ${result.executionError}`);
    }
  }

  const summary = calculateSummary(caseResults);
  const timestamp = dependencies.getTimestamp();
  const reportPath = `${datasetConfig.reportDirectory}/run-${timestamp.replace(/[.:]/g, "-")}.json`;
  const report = {
    metadata: {
      timestamp,
      dataset,
      latencyScope: "generation_calls_only",
      gitCommit: dependencies.getGitCommit(),
      configuredProvider: provider,
      configuredModel: model,
      ...(judgeProvider ? { judgeProvider } : {}),
      ...(judgeModel ? { judgeModel } : {}),
      caseId: caseId ?? null,
    },
    summary,
    cases: caseResults,
  };

  await dependencies.createReportDirectory(datasetConfig.reportDirectory);
  await dependencies.writeReport(reportPath, report);
  dependencies.log(`Suggestion eval: ${dataset}`);
  dependencies.log(`Cases: ${summary.totalCases}`);
  dependencies.log(`Passed: ${summary.passedCases}`);
  dependencies.log(`Quality failures: ${summary.qualityFailures}`);
  dependencies.log(`Evaluator failures: ${summary.evaluatorFailures}`);
  dependencies.log(`Execution failures: ${summary.executionFailures}`);
  dependencies.log(`Quality pass rate: ${summary.qualityPassRate ?? "n/a"}`);
  dependencies.log(`Report: ${reportPath}`);

  return { reportPath, report, summary, cases: caseResults };
};

export type {
  DatasetName,
  DatasetConfig,
  SuggestionEvalRouting,
  SuggestionEvalGeneration,
  SuggestionEvalCaseResult,
  SuggestionEvalSummary,
  SuggestionEvalRunnerDependencies,
  RunSuggestionEvalOptions,
};

export { calculateSummary, runSuggestionEval };
