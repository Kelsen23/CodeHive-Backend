import type { AiModerationResult } from "../../src/services/moderation/ai/aiModeration.service.js";
import { buildContentFields } from "../../src/services/moderation/ai/contentModeration.shared.js";

import type { ModerationEvalCase } from "./schema.js";
import { scoreModerationCase } from "./score.js";

type DatasetName = "dev" | "holdout" | "regression";

type DatasetConfig = {
  path: string;
  reportDirectory: string;
};

type ModerationEvalCaseResult = {
  caseId: string;
  description: string;
  tags: string[];
  status: ReturnType<typeof scoreModerationCase>["status"];
  assertions: ReturnType<typeof scoreModerationCase>["assertions"];
  expected: ModerationEvalCase["expected"];
  actual: AiModerationResult;
  latencyMs: number;
};

type TagSummary = {
  total: number;
  successfulExecutions: number;
  passedCases: number;
  passRate: number | null;
};

type ModerationEvalSummary = {
  totalCases: number;
  successfulExecutions: number;
  executionFailures: number;
  passedCases: number;
  qualityFailures: number;
  qualityPassRate: number | null;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  falsePositives: number;
  falseNegatives: number;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  flaggedFailures: number;
  categoryFailures: number;
  actionFailures: number;
  tags: Record<string, TagSummary>;
};

type ModerationEvalRunnerDependencies = {
  loadCases: (filename: string) => Promise<ModerationEvalCase[]>;
  moderateContent: (content: string) => Promise<AiModerationResult>;
  now: () => number;
  getTimestamp: () => string;
  getGitCommit: () => string | undefined;
  writeReport: (filename: string, report: unknown) => Promise<void>;
  createReportDirectory: (directory: string) => Promise<void>;
  log: (...values: unknown[]) => void;
};

type RunModerationEvalOptions = {
  dataset: DatasetName;
  datasetConfig: DatasetConfig;
  dependencies: ModerationEvalRunnerDependencies;
  provider: string;
  model: string;
};

const getContentForModeration = (testCase: ModerationEvalCase) => {
  return buildContentFields(testCase.input);
};

const runCase = async (
  testCase: ModerationEvalCase,
  dependencies: Pick<ModerationEvalRunnerDependencies, "moderateContent" | "now">,
): Promise<ModerationEvalCaseResult> => {
  const content = getContentForModeration(testCase);
  const startedAt = dependencies.now();
  let result: AiModerationResult;

  try {
    result = await dependencies.moderateContent(content);
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const score = scoreModerationCase(testCase.expected, result);
  const latencyMs = dependencies.now() - startedAt;

  return {
    caseId: testCase.id,
    description: testCase.description,
    tags: testCase.tags,
    status: score.status,
    assertions: score.assertions,
    expected: testCase.expected,
    actual: result,
    latencyMs,
  };
};

const calculateRate = (numerator: number, denominator: number) =>
  denominator === 0 ? null : numerator / denominator;

const calculateSummary = (
  cases: ModerationEvalCaseResult[],
): ModerationEvalSummary => {
  const successfulCases = cases.filter(
    ({ status }) => status !== "EXECUTION_FAILURE",
  );
  const passedCases = cases.filter(({ status }) => status === "PASS");
  const expectedSafeCases = successfulCases.filter(
    ({ expected }) => !expected.flagged,
  );
  const expectedUnsafeCases = successfulCases.filter(
    ({ expected }) => expected.flagged,
  );
  const falsePositives = expectedSafeCases.filter(
    ({ actual }) => actual.ok && actual.flagged,
  ).length;
  const falseNegatives = expectedUnsafeCases.filter(
    ({ actual }) => actual.ok && !actual.flagged,
  ).length;
  const failedAssertions = cases.flatMap(({ assertions }) =>
    assertions.filter(({ passed }) => !passed),
  );

  const latencies = cases
    .map(({ latencyMs }) => latencyMs)
    .sort((a, b) => a - b);
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
    falsePositives,
    falseNegatives,
    falsePositiveRate: calculateRate(falsePositives, expectedSafeCases.length),
    falseNegativeRate: calculateRate(
      falseNegatives,
      expectedUnsafeCases.length,
    ),
    flaggedFailures: failedAssertions.filter(({ name }) => name === "flagged")
      .length,
    categoryFailures: failedAssertions.filter(({ name }) => name === "category")
      .length,
    actionFailures: failedAssertions.filter(({ name }) => name === "action")
      .length,
    tags: Object.fromEntries(
      [...tagCounts.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
};

const formatPercentage = (rate: number | null) =>
  rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;

const printSummary = (
  dataset: DatasetName,
  summary: ModerationEvalSummary,
  reportPath: string,
  log: (...values: unknown[]) => void,
) => {
  log(`Moderation eval: ${dataset}`);
  log(`Cases: ${summary.totalCases}`);
  log(`Passed: ${summary.passedCases}`);
  log(`Quality failures: ${summary.qualityFailures}`);
  log(`Execution failures: ${summary.executionFailures}`);
  log(
    `Quality pass rate: ${formatPercentage(summary.qualityPassRate)}`,
  );
  log(`False positives: ${summary.falsePositives}`);
  log(`False negatives: ${summary.falseNegatives}`);
  log(
    `False-positive rate: ${formatPercentage(summary.falsePositiveRate)}`,
  );
  log(
    `False-negative rate: ${formatPercentage(summary.falseNegativeRate)}`,
  );

  if (Object.keys(summary.tags).length > 0) {
    log("Tag pass rates:");
    for (const [tag, tagSummary] of Object.entries(summary.tags)) {
      log(
        `  ${tag}: ${tagSummary.passedCases}/${tagSummary.successfulExecutions} (${formatPercentage(tagSummary.passRate)})`,
      );
    }
  }

  log(`Report: ${reportPath}`);
};

const runModerationEval = async ({
  dataset,
  datasetConfig,
  dependencies,
  provider,
  model,
}: RunModerationEvalOptions) => {
  const testCases = await dependencies.loadCases(datasetConfig.path);
  const caseResults: ModerationEvalCaseResult[] = [];

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

    if (result.status === "EXECUTION_FAILURE" && !result.actual.ok) {
      dependencies.log(`  ${result.actual.error}`);
    }
  }

  const summary = calculateSummary(caseResults);
  const timestamp = dependencies.getTimestamp();
  const reportDirectory = datasetConfig.reportDirectory;
  const reportPath = `${reportDirectory}/run-${timestamp.replace(/[.:]/g, "-")}.json`;
  const report = {
    metadata: {
      timestamp,
      dataset,
      latencyScope: "all_attempted_calls",
      gitCommit: dependencies.getGitCommit(),
      provider,
      model,
    },
    summary,
    cases: caseResults,
  };

  await dependencies.createReportDirectory(reportDirectory);
  await dependencies.writeReport(reportPath, report);
  printSummary(dataset, summary, reportPath, dependencies.log);

  return { reportPath, report, summary, cases: caseResults };
};

export type {
  DatasetName,
  DatasetConfig,
  ModerationEvalCaseResult,
  ModerationEvalSummary,
  ModerationEvalRunnerDependencies,
  RunModerationEvalOptions,
};

export {
  calculateSummary,
  getContentForModeration,
  runCase,
  runModerationEval,
};
