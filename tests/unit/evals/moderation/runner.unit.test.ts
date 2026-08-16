import { describe, expect, it, vi } from "vitest";

import {
  createModerationEvalCase,
  createModerationFailure,
  createModerationResult,
} from "../../../helpers/evals/moderation/fixtures.js";
import { createModerationEvalRunnerMocks } from "../../../helpers/evals/moderation/mockModerationEvalRunner.js";
import {
  calculateSummary,
  getContentForModeration,
  runCase,
  runModerationEval,
} from "../../../../evals/moderation/runner.js";
import type { ModerationEvalCase } from "../../../../evals/moderation/schema.js";

describe("moderation eval runner", () => {
  it.each([
    [
      {
        contentType: "QUESTION",
        title: "Question title",
        body: "Question body",
      },
      "Title: Question title\nBody: Question body",
    ],
    [
      { contentType: "ANSWER", body: "Answer body" },
      "Title: \nBody: Answer body",
    ],
    [
      { contentType: "REPLY", body: "Reply body" },
      "Title: \nBody: Reply body",
    ],
    [
      { contentType: "AI_ANSWER_FEEDBACK", body: "Feedback body" },
      "Title: \nBody: Feedback body",
    ],
  ])("builds moderation content for %j", (input, expected) => {
    expect(
      getContentForModeration(
        createModerationEvalCase({
          input: input as ModerationEvalCase["input"],
        }),
      ),
    ).toBe(expected);
  });

  it("runs one case, preserves actual output, and records latency", async () => {
    const now = vi.fn<() => number>().mockReturnValueOnce(10).mockReturnValueOnce(35);
    const moderateContent = vi.fn(async () => createModerationResult());
    const testCase = createModerationEvalCase();

    const result = await runCase(testCase, { moderateContent, now });

    expect(moderateContent).toHaveBeenCalledWith(
      "Title: \nBody: A test moderation message",
    );
    expect(result).toMatchObject({
      caseId: testCase.id,
      expected: testCase.expected,
      actual: createModerationResult(),
      status: "PASS",
      latencyMs: 25,
    });
  });

  it("continues after moderation execution failures", async () => {
    const cases = [
      createModerationEvalCase({ id: "pass" }),
      createModerationEvalCase({ id: "failure" }),
    ];
    const mocks = createModerationEvalRunnerMocks(cases);
    mocks.moderateContent
      .mockResolvedValueOnce(createModerationResult())
      .mockRejectedValueOnce(new Error("provider unavailable"));

    const result = await runModerationEval({
      dataset: "dev",
      datasetConfig: mocks.datasetConfig,
      dependencies: mocks.dependencies,
      provider: "fixture-provider",
      model: "fixture-model",
    });

    expect(mocks.moderateContent).toHaveBeenCalledTimes(2);
    expect(result.cases.map(({ status }) => status)).toEqual([
      "PASS",
      "EXECUTION_FAILURE",
    ]);
    expect(result.cases[1]?.actual).toEqual(
      createModerationFailure("provider unavailable"),
    );
  });

  it("calculates quality, latency, assertion, and tag metrics", () => {
    const cases = [
      {
        ...createModerationEvalCase({ id: "pass", tags: ["unsafe", "shared"] }),
        caseId: "pass",
        status: "PASS" as const,
        assertions: [
          { name: "flagged" as const, passed: true, expected: true, actual: true },
        ],
        actual: createModerationResult(),
        latencyMs: 10,
      },
      {
        ...createModerationEvalCase({
          id: "quality-failure",
          expected: { flagged: false },
          tags: ["safe", "shared"],
        }),
        caseId: "quality-failure",
        status: "QUALITY_FAILURE" as const,
        assertions: [
          { name: "flagged" as const, passed: false, expected: false, actual: true },
          { name: "action" as const, passed: false, expected: ["IGNORE"], actual: "WARN" },
        ],
        actual: createModerationResult(),
        latencyMs: 20,
      },
      {
        ...createModerationEvalCase({ id: "execution-failure", tags: ["unsafe"] }),
        caseId: "execution-failure",
        status: "EXECUTION_FAILURE" as const,
        assertions: [],
        actual: createModerationFailure(),
        latencyMs: 30,
      },
    ];

    const summary = calculateSummary(cases);

    expect(summary).toMatchObject({
      totalCases: 3,
      successfulExecutions: 2,
      executionFailures: 1,
      passedCases: 1,
      qualityFailures: 1,
      qualityPassRate: 0.5,
      averageLatencyMs: 20,
      medianLatencyMs: 20,
      falsePositives: 1,
      falseNegatives: 0,
      flaggedFailures: 1,
      actionFailures: 1,
    });
    expect(summary.tags.shared).toMatchObject({
      total: 2,
      successfulExecutions: 2,
      passedCases: 1,
      passRate: 0.5,
    });
  });

  it("writes a complete report after an empty dataset", async () => {
    const mocks = createModerationEvalRunnerMocks([]);

    const result = await runModerationEval({
      dataset: "regression",
      datasetConfig: mocks.datasetConfig,
      dependencies: mocks.dependencies,
      provider: "fixture-provider",
      model: "fixture-model",
    });

    expect(mocks.moderateContent).not.toHaveBeenCalled();
    expect(mocks.createReportDirectory).toHaveBeenCalledWith(
      mocks.datasetConfig.reportDirectory,
    );
    expect(mocks.writeReport).toHaveBeenCalledWith(
      "/fixtures/reports/run-2026-01-01T00-00-00-000Z.json",
      expect.objectContaining({
        metadata: expect.objectContaining({
          dataset: "regression",
          provider: "fixture-provider",
          model: "fixture-model",
        }),
        summary: expect.objectContaining({
          totalCases: 0,
          passedCases: 0,
          qualityPassRate: null,
        }),
        cases: [],
      }),
    );
    expect(result.reportPath).toBe(
      "/fixtures/reports/run-2026-01-01T00-00-00-000Z.json",
    );
  });
});
