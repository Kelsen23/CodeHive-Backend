import type { LLMMetadata } from "../../src/services/llmGateway/llmGateway.types.js";
import type { SecurityVerifierResult } from "../../src/validations/question/securityVerifier.schema.js";

import type { SecurityEvalCase, SecurityEvalInput } from "./schema.js";
import { scoreSecurityCase, type SecurityEvalActualResult } from "./score.js";

type DatasetName = "dev" | "holdout" | "regression";

type DatasetConfig = {
  path: string;
  reportDirectory: string;
};

type SecurityEvalRouting = Pick<
  LLMMetadata,
  "provider" | "model" | "fallbackUsed" | "routedModel"
>;

type SecurityEvalExecution = {
  result: SecurityVerifierResult;
  routing: SecurityEvalRouting;
};

type SecurityEvalCaseResult = {
  caseId: string;
  description: string;
  tags: string[];
  status: ReturnType<typeof scoreSecurityCase>["status"];
  assertions: ReturnType<typeof scoreSecurityCase>["assertions"];
  expected: SecurityEvalCase["expected"];
  actual: SecurityEvalActualResult;
  routing?: SecurityEvalRouting;
  latencyMs: number;
};

type TagSummary = {
  total: number;
  successfulExecutions: number;
  passedCases: number;
  passRate: number | null;
};

type SecurityEvalSummary = {
  totalCases: number;
  successfulExecutions: number;
  executionFailures: number;
  passedCases: number;
  qualityFailures: number;
  qualityPassRate: number | null;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  finalSecurityDecisionFailures: number;
  downstreamEligibilityFailures: number;
  promptInjectionDetectedFailures: number;
  promptInjectionRiskFailures: number;
  promptInjectionAttackTypeFailures: number;
  harmfulIntentDetectedFailures: number;
  harmfulIntentCategoryFailures: number;
  harmfulIntentSeverityFailures: number;
  defensiveFramingFailures: number;
  quotedTextIsolationFailures: number;
  tags: Record<string, TagSummary>;
};

type SecurityEvalRunnerDependencies = {
  loadCases: (filename: string) => Promise<SecurityEvalCase[]>;
  verifySecurity: (input: SecurityEvalInput) => Promise<SecurityEvalExecution>;
  now: () => number;
  getTimestamp: () => string;
  getGitCommit: () => string | undefined;
  writeReport: (filename: string, report: unknown) => Promise<void>;
  createReportDirectory: (directory: string) => Promise<void>;
  log: (...values: unknown[]) => void;
};

type RunSecurityEvalOptions = {
  dataset: DatasetName;
  datasetConfig: DatasetConfig;
  dependencies: SecurityEvalRunnerDependencies;
  provider: string;
  model: string;
};

const runCase = async (
  testCase: SecurityEvalCase,
  dependencies: Pick<SecurityEvalRunnerDependencies, "verifySecurity" | "now">,
): Promise<SecurityEvalCaseResult> => {
  const startedAt = dependencies.now();
  let result: SecurityEvalActualResult;
  let routing: SecurityEvalRouting | undefined;

  try {
    const execution = await dependencies.verifySecurity(testCase.input);
    result = execution.result;
    routing = execution.routing;
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const score = scoreSecurityCase(testCase.expected, result);

  return {
    caseId: testCase.id,
    description: testCase.description,
    tags: testCase.tags,
    status: score.status,
    assertions: score.assertions,
    expected: testCase.expected,
    actual: result,
    routing,
    latencyMs: dependencies.now() - startedAt,
  };
};

const calculateRate = (numerator: number, denominator: number) =>
  denominator === 0 ? null : numerator / denominator;

const calculateSummary = (
  cases: SecurityEvalCaseResult[],
): SecurityEvalSummary => {
  const successfulCases = cases.filter(
    ({ status }) => status !== "EXECUTION_FAILURE",
  );
  const passedCases = cases.filter(({ status }) => status === "PASS");
  const failedAssertions = cases.flatMap(({ assertions }) =>
    assertions.filter(({ passed }) => !passed),
  );
  const latencies = cases
    .map(({ latencyMs }) => latencyMs)
    .sort((left, right) => left - right);
  const medianLatencyMs =
    latencies.length === 0
      ? null
      : latencies.length % 2 === 1
        ? latencies[Math.floor(latencies.length / 2)]
        : (latencies[latencies.length / 2 - 1] +
            latencies[latencies.length / 2]) /
          2;
  const tagCounts = new Map<string, TagSummary>();

  for (const testCase of cases) {
    for (const tag of testCase.tags) {
      const summary = tagCounts.get(tag) ?? {
        total: 0,
        successfulExecutions: 0,
        passedCases: 0,
        passRate: null,
      };

      summary.total += 1;
      if (testCase.status !== "EXECUTION_FAILURE") {
        summary.successfulExecutions += 1;
      }
      if (testCase.status === "PASS") summary.passedCases += 1;
      summary.passRate = calculateRate(
        summary.passedCases,
        summary.successfulExecutions,
      );
      tagCounts.set(tag, summary);
    }
  }

  const countFailures = (name: string) =>
    failedAssertions.filter((assertion) => assertion.name === name).length;

  return {
    totalCases: cases.length,
    successfulExecutions: successfulCases.length,
    executionFailures: cases.length - successfulCases.length,
    passedCases: passedCases.length,
    qualityFailures: cases.filter(({ status }) => status === "QUALITY_FAILURE")
      .length,
    qualityPassRate: calculateRate(passedCases.length, successfulCases.length),
    averageLatencyMs: calculateRate(
      latencies.reduce((total, latencyMs) => total + latencyMs, 0),
      latencies.length,
    ),
    medianLatencyMs,
    finalSecurityDecisionFailures: countFailures("finalSecurityDecision"),
    downstreamEligibilityFailures: countFailures("downstreamEligibility"),
    promptInjectionDetectedFailures: countFailures("promptInjectionDetected"),
    promptInjectionRiskFailures: countFailures("promptInjectionRisk"),
    promptInjectionAttackTypeFailures: countFailures(
      "promptInjectionAttackType",
    ),
    harmfulIntentDetectedFailures: countFailures("harmfulIntentDetected"),
    harmfulIntentCategoryFailures: countFailures("harmfulIntentCategory"),
    harmfulIntentSeverityFailures: countFailures("harmfulIntentSeverity"),
    defensiveFramingFailures: countFailures("defensiveFraming"),
    quotedTextIsolationFailures: countFailures("quotedTextIsolation"),
    tags: Object.fromEntries(
      [...tagCounts.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
};

const formatPercentage = (rate: number | null) =>
  rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;

const runSecurityEval = async ({
  dataset,
  datasetConfig,
  dependencies,
  provider,
  model,
}: RunSecurityEvalOptions) => {
  const testCases = await dependencies.loadCases(datasetConfig.path);
  const caseResults: SecurityEvalCaseResult[] = [];

  for (const testCase of testCases) {
    const result = await runCase(testCase, dependencies);
    caseResults.push(result);

    const marker = result.status === "PASS" ? "✓" : "✗";
    dependencies.log(`${marker} ${result.caseId} ${result.status}`);

    if (result.status === "QUALITY_FAILURE") {
      for (const assertion of result.assertions) {
        if (!assertion.passed) {
          dependencies.log(
            `  ${assertion.name}: expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(assertion.actual)}`,
          );
        }
      }
    }

    if (
      result.status === "EXECUTION_FAILURE" &&
      "ok" in result.actual &&
      !result.actual.ok
    ) {
      dependencies.log(`  ${result.actual.error}`);
    }
  }

  const summary = calculateSummary(caseResults);
  const timestamp = dependencies.getTimestamp();
  const reportPath = `${datasetConfig.reportDirectory}/run-${timestamp.replace(/[.:]/g, "-")}.json`;
  const report = {
    metadata: {
      timestamp,
      dataset,
      latencyScope: "all_attempted_calls",
      gitCommit: dependencies.getGitCommit(),
      configuredProvider: provider,
      configuredModel: model,
    },
    summary,
    cases: caseResults,
  };

  await dependencies.createReportDirectory(datasetConfig.reportDirectory);
  await dependencies.writeReport(reportPath, report);

  dependencies.log(`Security eval: ${dataset}`);
  dependencies.log(`Cases: ${summary.totalCases}`);
  dependencies.log(`Passed: ${summary.passedCases}`);
  dependencies.log(`Quality failures: ${summary.qualityFailures}`);
  dependencies.log(`Execution failures: ${summary.executionFailures}`);
  dependencies.log(
    `Quality pass rate: ${formatPercentage(summary.qualityPassRate)}`,
  );
  dependencies.log(`Average latency: ${summary.averageLatencyMs ?? "n/a"}ms`);
  dependencies.log(`Median latency: ${summary.medianLatencyMs ?? "n/a"}ms`);
  dependencies.log(`Report: ${reportPath}`);

  return { reportPath, report, summary, cases: caseResults };
};

export type {
  DatasetName,
  DatasetConfig,
  SecurityEvalRouting,
  SecurityEvalExecution,
  SecurityEvalCaseResult,
  SecurityEvalSummary,
  SecurityEvalRunnerDependencies,
  RunSecurityEvalOptions,
};

export { calculateSummary, runCase, runSecurityEval };
