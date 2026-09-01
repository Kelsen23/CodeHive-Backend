import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  judgeSuggestionBatch,
  requestedCriteriaFromAssertions,
} from "../../../../evals/suggestion/judge.js";
import {
  suggestionSemanticJudgeBatchSchema,
  type SuggestionEvalInput,
} from "../../../../evals/suggestion/schema.js";
import type { QuestionSuggestionResult } from "../../../../src/validations/question/suggestion.schema.js";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("../../../../src/services/llmGateway/llmGateway.service.js", () => ({
  default: { generate },
}));

const input: SuggestionEvalInput = {
  title: "Why does my Node.js request fail?",
  body: "Node.js 22.3.0 returns ECONNRESET when I call the service.",
  tags: ["NODE_JS"],
};

const suggestion: QuestionSuggestionResult = {
  suggestedTitle: "Why does my Node.js request fail?",
  suggestedBody: "Node.js 22.3.0 returns ECONNRESET when I call the service.",
  suggestedTags: ["NODE_JS"],
  improvementTips: [],
};

const metadata = {
  feature: "suggestionEvalJudge",
  provider: "openai",
  model: "judge-model",
  fallbackUsed: false,
  promptHash: "hash",
  latencyMs: 10,
  usage: {},
  cost: {},
};

const batchResult = (caseId: string) => ({
  judgments: [
    {
      caseId,
      passed: true,
      reason: "The suggestion satisfies the criterion.",
    },
  ],
});

beforeEach(() => {
  generate.mockReset();
});

describe("suggestion semantic judge", () => {
  it("selects only explicitly enabled semantic criteria", () => {
    expect(
      requestedCriteriaFromAssertions({
        noInventedFacts: true,
        preserveMeaning: true,
        noDiagnosisOrSolution: false,
      }),
    ).toEqual(["noInventedFacts", "preserveMeaning"]);
  });

  it("validates one judgment per case in a batch", () => {
    expect(
      suggestionSemanticJudgeBatchSchema.parse(batchResult("case-1")),
    ).toEqual(batchResult("case-1"));

    expect(() =>
      suggestionSemanticJudgeBatchSchema.parse({
        judgments: [
          batchResult("case-1").judgments[0],
          batchResult("case-1").judgments[0],
        ],
      }),
    ).toThrow("Each suggestion case must appear exactly once per batch");
  });

  it("rejects duplicate judgments even when all expected IDs are present", async () => {
    generate.mockResolvedValueOnce({
      mode: "json",
      data: {
        judgments: [
          { caseId: "case-1", passed: true, reason: "Pass." },
          { caseId: "case-2", passed: true, reason: "Pass." },
          { caseId: "case-1", passed: true, reason: "Duplicate." },
        ],
      },
      metadata,
    });

    await expect(
      judgeSuggestionBatch({
        criterion: "preserveMeaning",
        items: [
          { caseId: "case-1", input, suggestion },
          { caseId: "case-2", input, suggestion },
        ],
      }),
    ).rejects.toThrow("did not return exactly one judgment for every case");
  });

  it("makes one gateway call for one criterion batch", async () => {
    generate.mockResolvedValueOnce({
      mode: "json",
      data: batchResult("case-1"),
      metadata,
    });

    const execution = await judgeSuggestionBatch({
      criterion: "noInventedFacts",
      items: [{ caseId: "case-1", input, suggestion }],
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      feature: "suggestionEvalJudge",
      mode: "json",
      temperature: 0,
      schema: suggestionSemanticJudgeBatchSchema,
    });
    expect(generate.mock.calls[0]?.[0].messages[1].content).toContain(
      '"criterion":"noInventedFacts"',
    );
    expect(execution).toEqual({ result: batchResult("case-1"), metadata });
  });

  it("rejects a response that omits an input case", async () => {
    generate.mockResolvedValueOnce({
      mode: "json",
      data: batchResult("other-case"),
      metadata,
    });

    await expect(
      judgeSuggestionBatch({
        criterion: "preserveMeaning",
        items: [{ caseId: "case-1", input, suggestion }],
      }),
    ).rejects.toThrow("did not return exactly one judgment for every case");
  });
});
