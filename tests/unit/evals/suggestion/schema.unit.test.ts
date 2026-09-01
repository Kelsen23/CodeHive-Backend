import { describe, expect, it } from "vitest";

import { suggestionEvalCaseSchema } from "../../../../evals/suggestion/schema.js";

const validCase = {
  id: "suggestion-001",
  description: "Preserves an explicit runtime version",
  input: {
    title: "Why does my Node.js request fail?",
    body: "Node.js 22.3.0 returns ECONNRESET when I call the service.",
    tags: ["NODE_JS"],
  },
  assertions: {
    mustPreserve: ["Node.js 22.3.0", "ECONNRESET"],
    requiredTags: ["NODE_JS"],
    noInventedFacts: true,
    preserveMeaning: true,
  },
  scenarioTags: ["evidence", "tags"],
};

describe("suggestion eval schema", () => {
  it("accepts flexible property-based assertions", () => {
    expect(
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: { ...validCase.assertions, preserveLanguage: true },
      }),
    ).toMatchObject({ assertions: { preserveLanguage: true } });
  });

  it("rejects unsupported tags and tip categories", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: {
          requiredTags: ["NOT_A_TAG"],
          requiredTipCategories: ["NOT_A_CATEGORY"],
        },
      }),
    ).toThrow();
  });

  it("rejects duplicate evidence and scenario tags", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: { mustPreserve: ["ECONNRESET", "ECONNRESET"] },
        scenarioTags: ["evidence", "evidence"],
      }),
    ).toThrow();
  });

  it("rejects contradictory benchmark assertions", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: {
          requiredTags: ["NODE_JS"],
          forbiddenTags: ["NODE_JS"],
          requiredTipCategories: ["MISSING_ERROR"],
          allowedTipCategories: ["CLARITY"],
          expectNoTips: true,
          tipCount: { min: 1, max: 0 },
        },
      }),
    ).toThrow();
  });

  it("rejects overlapping preservation assertions and incomplete tip ranges", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: {
          mustPreserve: ["ECONNRESET"],
          mustNotPreserve: ["ECONNRESET"],
          mustPreserveVerbatim: ["Node.js 22.3.0"],
          mustNotContain: ["Node.js 22.3.0"],
          tipCount: {},
        },
      }),
    ).toThrow();
  });

  it("rejects cross-overlapping preservation assertions", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: {
          mustPreserve: ["ECONNRESET"],
          mustNotContain: ["ECONNRESET"],
          mustPreserveVerbatim: ["Node.js 22.3.0"],
          mustNotPreserve: ["Node.js 22.3.0"],
        },
      }),
    ).toThrow();
  });

  it("rejects unknown case and assertion fields", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        unexpected: true,
      }),
    ).toThrow();

    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: { noDiagnosis: true },
      }),
    ).toThrow();
  });

  it("rejects contradictory zero-tip assertions", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: {
          expectNoTips: false,
          tipCount: { max: 0 },
        },
      }),
    ).toThrow();
  });

  it("rejects cases without active assertions", () => {
    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: {},
      }),
    ).toThrow();

    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        assertions: { noInventedFacts: false },
      }),
    ).toThrow();
  });

  it("validates eligibility diagnostics instead of silently dropping them", () => {
    const diagnosis = {
      decision: "CLARIFY",
      questionEligibilityStatus: "CLARIFY",
      userFacingReason: "More context is needed.",
      internalReason: "Missing reproduction details.",
    };

    expect(
      suggestionEvalCaseSchema.parse({
        ...validCase,
        input: { ...validCase.input, eligibilityGateDiagnosis: diagnosis },
      }).input.eligibilityGateDiagnosis,
    ).toEqual(diagnosis);

    expect(() =>
      suggestionEvalCaseSchema.parse({
        ...validCase,
        input: {
          ...validCase.input,
          eligibilityGateDiagnosis: {
            ...diagnosis,
            questionEligibilityStatus: "INVALID",
          },
        },
      }),
    ).toThrow();
  });
});
