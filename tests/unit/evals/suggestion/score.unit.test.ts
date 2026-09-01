import { describe, expect, it, vi } from "vitest";

import {
  scoreDeterministicAssertions,
  scoreQuestionSuggestionCase,
  scoreSuggestionCases,
  severityForSemanticCriterion,
} from "../../../../evals/suggestion/score.js";
import type { ScoreSuggestionCasesOptions } from "../../../../evals/suggestion/score.js";
import type { SuggestionEvalCase } from "../../../../evals/suggestion/schema.js";
import type { QuestionSuggestionResult } from "../../../../src/validations/question/suggestion.schema.js";

const testCase: SuggestionEvalCase = {
  id: "suggestion-001",
  description: "Preserves evidence and validates tags and tips",
  input: {
    title: "Why does my Node.js request fail?",
    body: "Node.js 22.3.0 returns ECONNRESET when I call the service.",
    tags: ["NODE_JS"],
  },
  assertions: {
    mustPreserveVerbatim: ["ECONNRESET"],
    mustNotContain: ["PostgreSQL"],
    mustNotPreserve: ["copied documentation"],
    requiredTags: ["NODE_JS"],
    forbiddenTags: ["POSTGRESQL"],
    requiredTipCategories: ["MISSING_ERROR"],
    allowedTipCategories: ["MISSING_ERROR", "MISSING_CONTEXT"],
    forbiddenTipCategories: ["CLARITY"],
    tipCount: { min: 1, max: 2 },
  },
  scenarioTags: ["fixture"],
};

const validSuggestion: QuestionSuggestionResult = {
  suggestedTitle: "Why does my Node.js request fail?",
  suggestedBody: "Node.js 22.3.0 returns ECONNRESET when I call the service.",
  suggestedTags: ["NODE_JS"],
  improvementTips: [
    { category: "MISSING_ERROR", message: "Include the response details." },
  ],
};

describe("scoreQuestionSuggestionCase", () => {
  it("passes deterministic contract assertions", () => {
    const score = scoreQuestionSuggestionCase(testCase, validSuggestion);

    expect(score.status).toBe("PASS");
    expect(score.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it("reports evidence, tag, tip, and count failures", () => {
    const score = scoreQuestionSuggestionCase(testCase, {
      ...validSuggestion,
      suggestedBody: "Node.js 22.3.0 uses PostgreSQL.",
      suggestedTags: ["POSTGRESQL"],
      improvementTips: [{ category: "CLARITY", message: "Be clearer." }],
    });

    expect(score.status).toBe("QUALITY_FAILURE");
    expect(
      score.assertions.filter(({ passed }) => !passed).map(({ name }) => name),
    ).toEqual([
      "mustPreserveVerbatim:ECONNRESET",
      "mustNotContain:PostgreSQL",
      "requiredTag:NODE_JS",
      "forbiddenTag:POSTGRESQL",
      "requiredTipCategory:MISSING_ERROR",
      "allowedTipCategories",
      "forbiddenTipCategories",
    ]);
  });

  it("reports malformed generated output as a critical schema failure", () => {
    const score = scoreQuestionSuggestionCase(testCase, {
      suggestedTitle: "short",
    });

    expect(score).toMatchObject({
      status: "QUALITY_FAILURE",
      assertions: [{ name: "schema", severity: "CRITICAL", passed: false }],
    });
  });
});

describe("scoreDeterministicAssertions", () => {
  it("scores required evidence preservation", () => {
    expect(
      scoreDeterministicAssertions(
        { mustPreserve: ["ECONNRESET"] },
        validSuggestion,
      ),
    ).toEqual([
      {
        name: "mustPreserve:ECONNRESET",
        passed: true,
        severity: "MAJOR",
        expected: "ECONNRESET",
        actual: true,
      },
    ]);
  });

  it("reports suggested body maximum length explicitly", () => {
    const assertions = scoreDeterministicAssertions(
      { suggestedBodyMaxLength: 20 },
      validSuggestion,
    );

    expect(assertions).toEqual([
      {
        name: "suggestedBodyMaxLength",
        passed: false,
        severity: "CRITICAL",
        expected: "<= 20",
        actual: validSuggestion.suggestedBody.length,
      },
    ]);
  });

  it("does not evaluate semantic assertions as string matches", () => {
    const assertions = scoreDeterministicAssertions(
      {
        noInventedFacts: true,
        noDiagnosisOrSolution: true,
        preserveMeaning: true,
        preserveUncertainty: true,
        tipsOnlyForMissingInformation: true,
      },
      validSuggestion,
    );

    expect(assertions).toEqual([]);
  });
});

describe("scoreSuggestionCases", () => {
  it("uses rubric severity for semantic criteria", () => {
    expect(severityForSemanticCriterion("noInventedFacts")).toBe("CRITICAL");
    expect(severityForSemanticCriterion("noDiagnosisOrSolution")).toBe(
      "CRITICAL",
    );
    expect(severityForSemanticCriterion("preserveMeaning")).toBe("CRITICAL");
    expect(severityForSemanticCriterion("preserveUncertainty")).toBe("MAJOR");
    expect(severityForSemanticCriterion("preserveLanguage")).toBe("MAJOR");
    expect(severityForSemanticCriterion("tipsOnlyForMissingInformation")).toBe(
      "MAJOR",
    );
  });

  it("batches each semantic criterion independently and maps judgments to cases", async () => {
    const cases = Array.from({ length: 6 }, (_, index) => ({
      testCase: {
        ...testCase,
        id: `suggestion-${index + 1}`,
        assertions: {
          preserveMeaning: true,
        },
      },
      suggestion: validSuggestion,
    }));
    const judge = vi.fn(
      async ({
        items,
      }: Parameters<NonNullable<ScoreSuggestionCasesOptions["judge"]>>[0]) =>
        ({
          result: {
            judgments: items.map(({ caseId }) => ({
              caseId,
              passed: caseId !== "suggestion-6",
              reason: "The rewrite preserves the original meaning.",
            })),
          },
          metadata: {} as never,
        }) as Awaited<
          ReturnType<NonNullable<ScoreSuggestionCasesOptions["judge"]>>
        >,
    );

    const scores = await scoreSuggestionCases({ cases, judge });

    expect(judge).toHaveBeenCalledTimes(2);
    expect(
      judge.mock.calls.map(([call]) => call.items.map(({ caseId }) => caseId)),
    ).toEqual([
      [
        "suggestion-1",
        "suggestion-2",
        "suggestion-3",
        "suggestion-4",
        "suggestion-5",
      ],
      ["suggestion-6"],
    ]);
    expect(
      scores[0]?.score.assertions[scores[0].score.assertions.length - 1],
    ).toMatchObject({
      name: "preserveMeaning",
      passed: true,
      severity: "CRITICAL",
    });
    expect(scores[5]?.score).toMatchObject({
      status: "QUALITY_FAILURE",
      assertions: [
        {
          name: "preserveMeaning",
          passed: false,
          message: "The rewrite preserves the original meaning.",
        },
      ],
    });
  });

  it("does not send schema-invalid suggestions to the semantic judge", async () => {
    const judge = vi.fn();

    const scores = await scoreSuggestionCases({
      cases: [
        {
          testCase: {
            ...testCase,
            assertions: { preserveMeaning: true },
          },
          suggestion: { suggestedTitle: "invalid" },
        },
      ],
      judge,
    });

    expect(judge).not.toHaveBeenCalled();
    expect(scores[0]?.score.status).toBe("QUALITY_FAILURE");
  });

  it("keeps judge failures separate from suggestion quality failures", async () => {
    const judge = vi.fn(async () => {
      throw new Error("judge timed out");
    });

    const scores = await scoreSuggestionCases({
      cases: [
        {
          testCase: {
            ...testCase,
            assertions: { preserveMeaning: true },
          },
          suggestion: validSuggestion,
        },
      ],
      judge,
    });

    expect(scores[0]?.score).toMatchObject({
      status: "EVALUATOR_FAILURE",
      evaluatorError: "preserveMeaning: judge timed out",
    });
    expect(scores[0]?.score.assertions).not.toContainEqual(
      expect.objectContaining({ name: "preserveMeaning" }),
    );
  });

  it("does not hide deterministic quality failures when the judge fails", async () => {
    const judge = vi.fn(async () => {
      throw new Error("judge timed out");
    });

    const scores = await scoreSuggestionCases({
      cases: [
        {
          testCase: {
            ...testCase,
            assertions: {
              mustPreserve: ["not present"],
              preserveMeaning: true,
            },
          },
          suggestion: validSuggestion,
        },
      ],
      judge,
    });

    expect(scores[0]?.score).toMatchObject({
      status: "QUALITY_FAILURE",
      evaluatorError: "preserveMeaning: judge timed out",
    });
  });

  it("keeps later semantic quality failures after an earlier judge failure", async () => {
    const judge = vi
      .fn()
      .mockRejectedValueOnce(new Error("first criterion timed out"))
      .mockResolvedValueOnce({
        result: {
          judgments: [
            {
              caseId: testCase.id,
              passed: false,
              reason: "The generated suggestion changes the meaning.",
            },
          ],
        },
        metadata: {} as never,
      });

    const scores = await scoreSuggestionCases({
      cases: [
        {
          testCase: {
            ...testCase,
            assertions: {
              noInventedFacts: true,
              preserveMeaning: true,
            },
          },
          suggestion: validSuggestion,
        },
      ],
      judge,
    });

    expect(scores[0]?.score).toMatchObject({
      status: "QUALITY_FAILURE",
      evaluatorError: "noInventedFacts: first criterion timed out",
    });
    expect(scores[0]?.score.assertions).toContainEqual(
      expect.objectContaining({
        name: "preserveMeaning",
        passed: false,
      }),
    );
  });
});
