import type { QuestionEligibilityGateResult } from "../../src/validations/question/eligibilityGate.schema.js";
import type { LLMMetadata } from "../../src/services/llmGateway/llmGateway.types.js";

import type {
  QuestionEligibilityEvalCase,
  QuestionEligibilityEvalInput,
} from "./schema.js";
import {
  scoreQuestionEligibilityCase,
  type EligibilityEvalActualResult,
} from "./score.js";

type DatasetName = "dev" | "holdout" | "regression";

type DatasetConfig = {
  path: string;
  reportDirectory: string;
};

type QuestionEligibilityEvalCaseResult = {
  caseId: string;
  description: string;
  tags: string[];
  status: ReturnType<typeof scoreQuestionEligibilityCase>["status"];
  assertions: ReturnType<typeof scoreQuestionEligibilityCase>["assertions"];
  expected: QuestionEligibilityEvalCase["expected"];
  actual: EligibilityEvalActualResult;
  routing?: Pick<
    LLMMetadata,
    "provider" | "model" | "fallbackUsed" | "routedModel"
  >;
  latencyMs: number;
};

type QuestionEligibilityEvalExecution = {
  result: QuestionEligibilityGateResult;
  routing: Pick<
    LLMMetadata,
    "provider" | "model" | "fallbackUsed" | "routedModel"
  >;
};

type TagSummary = {
  total: number;
  successfulExecutions: number;
  passedCases: number;
  passRate: number | null;
};

type QuestionEligibilityEvalSummary = {
  totalCases: number;
  successfulExecutions: number;
  executionFailures: number;
  passedCases: number;
  qualityFailures: number;
  qualityPassRate: number | null;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  decisionFailures: number;
  downstreamEligibilityFailures: number;
  understandabilityFailures: number;
  softwareRelatedFailures: number;
  realProblemFailures: number;
  intentFailures: number;
  questionableEntitiesFailures: number;
  answerabilityFailures: number;
  promptInjectionRiskFailures: number;
  suspiciousInstructionFailures: number;
  harmfulTechnicalIntentFailures: number;
  tags: Record<string, TagSummary>;
};

type QuestionEligibilityEvalRunnerDependencies = {
  loadCases: (filename: string) => Promise<QuestionEligibilityEvalCase[]>;
  evaluateEligibility: (
    input: QuestionEligibilityEvalInput,
  ) => Promise<QuestionEligibilityEvalExecution>;
  now: () => number;
  getTimestamp: () => string;
  getGitCommit: () => string | undefined;
  writeReport: (filename: string, report: unknown) => Promise<void>;
  createReportDirectory: (directory: string) => Promise<void>;
  log: (...values: unknown[]) => void;
};

type RunQuestionEligibilityEvalOptions = {
  dataset: DatasetName;
  datasetConfig: DatasetConfig;
  dependencies: QuestionEligibilityEvalRunnerDependencies;
  provider: string;
  model: string;
};

const runCase = async (
  testCase: QuestionEligibilityEvalCase,
  dependencies: Pick<
    QuestionEligibilityEvalRunnerDependencies,
    "evaluateEligibility" | "now"
  >,
): Promise<QuestionEligibilityEvalCaseResult> => {
  const startedAt = dependencies.now();
  let result: EligibilityEvalActualResult;
  let routing: QuestionEligibilityEvalCaseResult["routing"];

  try {
    const execution = await dependencies.evaluateEligibility(testCase.input);
    result = execution.result;
    routing = execution.routing;
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const score = scoreQuestionEligibilityCase(testCase.expected, result);

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
  cases: QuestionEligibilityEvalCaseResult[],
): QuestionEligibilityEvalSummary => {
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
    decisionFailures: countFailures("decision"),
    downstreamEligibilityFailures: countFailures("downstreamEligibility"),
    understandabilityFailures: countFailures("understandability"),
    softwareRelatedFailures: countFailures("softwareRelated"),
    realProblemFailures: countFailures("realProblem"),
    intentFailures: countFailures("intent"),
    questionableEntitiesFailures: countFailures("questionableEntities"),
    answerabilityFailures: countFailures("answerability"),
    promptInjectionRiskFailures: countFailures("promptInjectionRisk"),
    suspiciousInstructionFailures: countFailures("suspiciousInstruction"),
    harmfulTechnicalIntentFailures: countFailures("harmfulTechnicalIntent"),
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
  summary: QuestionEligibilityEvalSummary,
  reportPath: string,
  log: (...values: unknown[]) => void,
) => {
  log(`Question eligibility eval: ${dataset}`);
  log(`Cases: ${summary.totalCases}`);
  log(`Passed: ${summary.passedCases}`);
  log(`Quality failures: ${summary.qualityFailures}`);
  log(`Execution failures: ${summary.executionFailures}`);
  log(`Quality pass rate: ${formatPercentage(summary.qualityPassRate)}`);
  log(`Average latency: ${summary.averageLatencyMs ?? "n/a"}ms`);
  log(`Median latency: ${summary.medianLatencyMs ?? "n/a"}ms`);
  log("Assertion failures:");
  log(
    `  decision=${summary.decisionFailures}, downstreamEligibility=${summary.downstreamEligibilityFailures}, understandability=${summary.understandabilityFailures}, softwareRelated=${summary.softwareRelatedFailures}, realProblem=${summary.realProblemFailures}, intent=${summary.intentFailures}, questionableEntities=${summary.questionableEntitiesFailures}, answerability=${summary.answerabilityFailures}, promptInjectionRisk=${summary.promptInjectionRiskFailures}, suspiciousInstruction=${summary.suspiciousInstructionFailures}, harmfulTechnicalIntent=${summary.harmfulTechnicalIntentFailures}`,
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

const runQuestionEligibilityEval = async ({
  dataset,
  datasetConfig,
  dependencies,
  provider,
  model,
}: RunQuestionEligibilityEvalOptions) => {
  const testCases = await dependencies.loadCases(datasetConfig.path);
  const caseResults: QuestionEligibilityEvalCaseResult[] = [];

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
  printSummary(dataset, summary, reportPath, dependencies.log);

  return { reportPath, report, summary, cases: caseResults };
};

export type {
  DatasetName,
  DatasetConfig,
  QuestionEligibilityEvalCaseResult,
  QuestionEligibilityEvalSummary,
  QuestionEligibilityEvalRunnerDependencies,
  RunQuestionEligibilityEvalOptions,
  QuestionEligibilityEvalExecution,
};

export { calculateSummary, runCase, runQuestionEligibilityEval };
