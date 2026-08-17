import { describe, expect, it, vi } from "vitest";

import {
  createSecurityEvalCase,
  createSecurityExecution,
  createSecurityFailure,
  createSecurityResult,
} from "../../../helpers/evals/security/fixtures.js";
import { createSecurityEvalRunnerMocks } from "../../../helpers/evals/security/mockSecurityEvalRunner.js";
import {
  calculateSummary,
  runCase,
  runSecurityEval,
} from "../../../../evals/security/runner.js";

describe("security eval runner", () => {
  it("passes input, preserves actual output and routing, and records latency", async () => {
    const testCase = createSecurityEvalCase();
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(35);
    const execution = createSecurityExecution(createSecurityResult(), {
      provider: "anthropic",
      model: "fallback-model",
      fallbackUsed: true,
      routedModel: "fallback-model",
    });
    const verifySecurity = vi.fn(async () => execution);

    const result = await runCase(testCase, { verifySecurity, now });

    expect(verifySecurity).toHaveBeenCalledWith(testCase.input);
    expect(result).toMatchObject({
      caseId: testCase.id,
      expected: testCase.expected,
      actual: createSecurityResult(),
      routing: execution.routing,
      status: "PASS",
      latencyMs: 25,
    });
  });

  it("continues after execution failures and writes the completed report", async () => {
    const cases = [
      createSecurityEvalCase({ id: "pass" }),
      createSecurityEvalCase({ id: "failure" }),
    ];
    const mocks = createSecurityEvalRunnerMocks(cases);
    mocks.verifySecurity
      .mockResolvedValueOnce(createSecurityExecution())
      .mockRejectedValueOnce(new Error("provider unavailable"));

    const result = await runSecurityEval({
      dataset: "dev",
      datasetConfig: mocks.datasetConfig,
      dependencies: mocks.dependencies,
      provider: "fixture-provider",
      model: "fixture-model",
    });

    expect(mocks.loadCases).toHaveBeenCalledWith(mocks.datasetConfig.path);
    expect(mocks.verifySecurity).toHaveBeenCalledTimes(2);
    expect(result.cases.map(({ status }) => status)).toEqual([
      "PASS",
      "EXECUTION_FAILURE",
    ]);
    expect(result.cases[1]?.actual).toEqual(
      createSecurityFailure("provider unavailable"),
    );
    expect(mocks.writeReport).toHaveBeenCalledWith(
      "/fixtures/reports/run-2026-01-01T00-00-00-000Z.json",
      expect.objectContaining({
        metadata: expect.objectContaining({
          configuredProvider: "fixture-provider",
          configuredModel: "fixture-model",
        }),
        cases: result.cases,
      }),
    );
  });

  it("calculates assertion, latency, and tag metrics", () => {
    const passCase = createSecurityEvalCase({
      id: "pass",
      tags: ["safe", "shared"],
    });
    const failureCase = createSecurityEvalCase({
      id: "quality-failure",
      tags: ["unsafe", "shared"],
    });
    const executionFailureCase = createSecurityEvalCase({
      id: "execution-failure",
      tags: ["unsafe"],
    });

    const summary = calculateSummary([
      {
        ...passCase,
        caseId: passCase.id,
        status: "PASS",
        assertions: [
          {
            name: "finalSecurityDecision",
            passed: true,
            expected: "ALLOW",
            actual: "ALLOW",
          },
        ],
        actual: createSecurityResult(),
        latencyMs: 10,
      },
      {
        ...failureCase,
        caseId: failureCase.id,
        status: "QUALITY_FAILURE",
        assertions: [
          {
            name: "finalSecurityDecision",
            passed: false,
            expected: "ALLOW",
            actual: "REJECT",
          },
          {
            name: "harmfulIntentCategory",
            passed: false,
            expected: ["NONE"],
            actual: "MALWARE",
          },
        ],
        actual: createSecurityResult(),
        latencyMs: 20,
      },
      {
        ...executionFailureCase,
        caseId: executionFailureCase.id,
        status: "EXECUTION_FAILURE",
        assertions: [],
        actual: createSecurityFailure(),
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
      finalSecurityDecisionFailures: 1,
      harmfulIntentCategoryFailures: 1,
    });
    expect(summary.tags.shared).toMatchObject({
      total: 2,
      successfulExecutions: 2,
      passedCases: 1,
      passRate: 0.5,
    });
  });

  it("writes an empty report without invoking the verifier", async () => {
    const mocks = createSecurityEvalRunnerMocks([]);

    const result = await runSecurityEval({
      dataset: "regression",
      datasetConfig: mocks.datasetConfig,
      dependencies: mocks.dependencies,
      provider: "fixture-provider",
      model: "fixture-model",
    });

    expect(mocks.verifySecurity).not.toHaveBeenCalled();
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
