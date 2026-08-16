import { describe, expect, it, vi } from "vitest";

import {
  createEligibilityFailure,
  createEligibilityResult,
  createQuestionEligibilityEvalCase,
} from "../../../helpers/evals/eligibility/fixtures.js";
import { createEligibilityEvalRunnerMocks } from "../../../helpers/evals/eligibility/mockEligibilityEvalRunner.js";
import {
  calculateSummary,
  runCase,
  runQuestionEligibilityEval,
} from "../../../../evals/eligibility/runner.js";

describe("question eligibility eval runner", () => {
  it("passes the selected dataset input, preserves actual output, and records latency", async () => {
    const testCase = createQuestionEligibilityEvalCase();
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(35);
    const evaluateEligibility = vi.fn(async () => createEligibilityResult());

    const result = await runCase(testCase, { evaluateEligibility, now });

    expect(evaluateEligibility).toHaveBeenCalledWith(testCase.input);
    expect(result).toMatchObject({
      caseId: testCase.id,
      expected: testCase.expected,
      actual: createEligibilityResult(),
      status: "PASS",
      latencyMs: 25,
    });
  });

  it("continues after execution failures and writes the completed report", async () => {
    const cases = [
      createQuestionEligibilityEvalCase({ id: "pass" }),
      createQuestionEligibilityEvalCase({ id: "failure" }),
    ];
    const mocks = createEligibilityEvalRunnerMocks(cases);
    mocks.evaluateEligibility
      .mockResolvedValueOnce(createEligibilityResult())
      .mockRejectedValueOnce(new Error("provider unavailable"));

    const result = await runQuestionEligibilityEval({
      dataset: "dev",
      datasetConfig: mocks.datasetConfig,
      dependencies: mocks.dependencies,
      provider: "fixture-provider",
      model: "fixture-model",
    });

    expect(mocks.loadCases).toHaveBeenCalledWith(mocks.datasetConfig.path);
    expect(mocks.evaluateEligibility).toHaveBeenCalledTimes(2);
    expect(result.cases.map(({ status }) => status)).toEqual([
      "PASS",
      "EXECUTION_FAILURE",
    ]);
    expect(result.cases[1]?.actual).toEqual(
      createEligibilityFailure("provider unavailable"),
    );
    expect(mocks.writeReport).toHaveBeenCalledWith(
      "/fixtures/reports/run-2026-01-01T00-00-00-000Z.json",
      expect.objectContaining({ cases: result.cases }),
    );
  });

  it("calculates quality, assertion, latency, and tag metrics", () => {
    const passCase = createQuestionEligibilityEvalCase({
      id: "pass",
      tags: ["safe", "shared"],
    });
    const failureCase = createQuestionEligibilityEvalCase({
      id: "quality-failure",
      tags: ["unsafe", "shared"],
    });
    const executionFailureCase = createQuestionEligibilityEvalCase({
      id: "execution-failure",
      tags: ["unsafe"],
    });

    const summary = calculateSummary([
      {
        ...passCase,
        caseId: passCase.id,
        status: "PASS",
        assertions: [
          { name: "decision", passed: true, expected: "ALLOW", actual: "ALLOW" },
        ],
        actual: createEligibilityResult(),
        latencyMs: 10,
      },
      {
        ...failureCase,
        caseId: failureCase.id,
        status: "QUALITY_FAILURE",
        assertions: [
          { name: "decision", passed: false, expected: "ALLOW", actual: "REJECT" },
          { name: "intent", passed: false, expected: ["DEBUGGING"], actual: "ARCHITECTURE" },
          { name: "answerability", passed: false, expected: "ANSWERABLE", actual: "NOT_ANSWERABLE" },
        ],
        actual: createEligibilityResult(),
        latencyMs: 20,
      },
      {
        ...executionFailureCase,
        caseId: executionFailureCase.id,
        status: "EXECUTION_FAILURE",
        assertions: [],
        actual: createEligibilityFailure(),
        latencyMs: 30,
      },
    ]);

    expect(summary).toMatchObject({
      totalCases: 3,
      successfulExecutions: 2,
      executionFailures: 1,
      passedCases: 1,
      qualityFailures: 1,
      qualityPassRate: 0.5,
      averageLatencyMs: 20,
      medianLatencyMs: 20,
      decisionFailures: 1,
      intentFailures: 1,
      answerabilityFailures: 1,
    });
    expect(summary.tags.shared).toMatchObject({
      total: 2,
      successfulExecutions: 2,
      passedCases: 1,
      passRate: 0.5,
    });
    expect(summary.tags.unsafe).toMatchObject({
      total: 2,
      successfulExecutions: 1,
      passedCases: 0,
      passRate: 0,
    });
  });

  it("produces an empty report without invoking the evaluator", async () => {
    const mocks = createEligibilityEvalRunnerMocks([]);

    const result = await runQuestionEligibilityEval({
      dataset: "regression",
      datasetConfig: mocks.datasetConfig,
      dependencies: mocks.dependencies,
      provider: "fixture-provider",
      model: "fixture-model",
    });

    expect(mocks.evaluateEligibility).not.toHaveBeenCalled();
    expect(result.summary).toMatchObject({
      totalCases: 0,
      passedCases: 0,
      qualityPassRate: null,
      averageLatencyMs: null,
      medianLatencyMs: null,
    });
    expect(mocks.writeReport).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ summary: result.summary, cases: [] }),
    );
  });
});
