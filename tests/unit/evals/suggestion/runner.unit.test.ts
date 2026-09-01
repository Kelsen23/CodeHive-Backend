import { describe, expect, it, vi } from "vitest";

import {
  calculateSummary,
  runSuggestionEval,
  type SuggestionEvalRunnerDependencies,
  type SuggestionEvalGeneration,
} from "../../../../evals/suggestion/runner.js";
import type {
  SuggestionEvalCase,
  SuggestionEvalInput,
} from "../../../../evals/suggestion/schema.js";
import type { LLMProvider } from "../../../../src/services/llmGateway/llmGateway.types.js";

const suggestion = {
  suggestedTitle: "Why does my Node.js request fail?",
  suggestedBody: "Node.js returns ECONNRESET when the service is called.",
  suggestedTags: ["NODE_JS"] as ["NODE_JS"],
  improvementTips: [],
};

const makeCase = (id: string): SuggestionEvalCase => ({
  id,
  description: "A suggestion eval case",
  input: {
    title: "Why does my Node.js request fail?",
    body: "Node.js returns ECONNRESET when the service is called.",
    tags: ["NODE_JS"],
  },
  assertions: { preserveMeaning: true },
  scenarioTags: ["debugging"],
});

const makeDependencies = (
  overrides: Partial<SuggestionEvalRunnerDependencies> = {},
) => {
  let now = 0;
  const cases = [
    makeCase("suggestion-dev-001"),
    makeCase("suggestion-dev-002"),
  ];

  return {
    cases,
    dependencies: {
      loadCases: vi.fn(async () => cases),
      generateSuggestion: vi.fn(
        async (
          input: SuggestionEvalInput,
        ): Promise<SuggestionEvalGeneration> => ({
          suggestion: { ...suggestion, suggestedBody: input.body },
          routing: {
            provider: "provider" as LLMProvider,
            model: "model",
            fallbackUsed: false,
            routedModel: "model",
          },
        }),
      ),
      scoreCases: vi.fn(
        async ({
          cases: generatedCases,
        }: Parameters<SuggestionEvalRunnerDependencies["scoreCases"]>[0]) =>
          generatedCases.map(({ testCase, suggestion: actual }) => ({
            caseId: testCase.id,
            score: {
              status: "PASS" as const,
              assertions: [],
              actual,
            },
          })),
      ),
      now: () => now++,
      getTimestamp: () => "2026-09-01T12:00:00.000Z",
      getGitCommit: () => "commit",
      writeReport: vi.fn(async () => undefined),
      createReportDirectory: vi.fn(async () => undefined),
      log: vi.fn(),
      ...overrides,
    } satisfies SuggestionEvalRunnerDependencies,
  };
};

describe("runSuggestionEval", () => {
  it("generates, scores, and writes a report for every case", async () => {
    const { cases, dependencies } = makeDependencies();

    const execution = await runSuggestionEval({
      dataset: "dev",
      datasetConfig: { path: "cases.jsonl", reportDirectory: "reports" },
      dependencies,
      provider: "provider",
      model: "model",
    });

    expect(dependencies.generateSuggestion).toHaveBeenCalledTimes(2);
    expect(dependencies.scoreCases).toHaveBeenCalledTimes(1);
    expect(execution.cases.map(({ caseId }) => caseId)).toEqual(
      cases.map(({ id }) => id),
    );
    expect(execution.summary).toMatchObject({
      totalCases: 2,
      passedCases: 2,
      qualityFailures: 0,
      evaluatorFailures: 0,
      executionFailures: 0,
    });
    expect(dependencies.writeReport).toHaveBeenCalledWith(
      "reports/run-2026-09-01T12-00-00-000Z.json",
      expect.objectContaining({ summary: execution.summary }),
    );
  });

  it("records generation errors separately from quality failures", async () => {
    const generateSuggestion = vi
      .fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({
        suggestion,
        routing: {
          provider: "provider",
          model: "model",
          fallbackUsed: false,
          routedModel: "model",
        },
      });
    const { dependencies } = makeDependencies({ generateSuggestion });

    const execution = await runSuggestionEval({
      dataset: "dev",
      datasetConfig: { path: "cases.jsonl", reportDirectory: "reports" },
      dependencies,
      provider: "provider",
      model: "model",
    });

    expect(execution.cases[0]).toMatchObject({
      status: "EXECUTION_FAILURE",
      executionError: "provider unavailable",
    });
    expect(execution.summary.executionFailures).toBe(1);
    expect(execution.summary.qualityFailures).toBe(0);
  });

  it("supports running one selected case", async () => {
    const { dependencies } = makeDependencies();

    const execution = await runSuggestionEval({
      dataset: "dev",
      datasetConfig: { path: "cases.jsonl", reportDirectory: "reports" },
      dependencies,
      provider: "provider",
      model: "model",
      caseId: "suggestion-dev-002",
    });

    expect(execution.cases.map(({ caseId }) => caseId)).toEqual([
      "suggestion-dev-002",
    ]);
    expect(dependencies.generateSuggestion).toHaveBeenCalledTimes(1);
  });

  it("counts evaluator failures separately", () => {
    expect(
      calculateSummary([
        {
          caseId: "suggestion-dev-001",
          description: "case",
          tags: ["debugging"],
          status: "EVALUATOR_FAILURE",
          assertions: [],
          expected: {},
          actual: suggestion,
          evaluatorError: "judge timed out",
          latencyMs: 10,
        },
      ]),
    ).toMatchObject({
      totalCases: 1,
      evaluatorFailures: 1,
      qualityFailures: 0,
      executionFailures: 0,
      qualityPassRate: null,
    });
  });
});
