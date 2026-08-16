import { describe, expect, it } from "vitest";

import {
  createEligibilityFailure,
  createEligibilityResult,
  createQuestionEligibilityEvalCase,
} from "../../../helpers/evals/eligibility/fixtures.js";
import { scoreQuestionEligibilityCase } from "../../../../evals/eligibility/score.js";

describe("scoreQuestionEligibilityCase", () => {
  it("passes all matching assertions", () => {
    const testCase = createQuestionEligibilityEvalCase();

    const score = scoreQuestionEligibilityCase(
      testCase.expected,
      createEligibilityResult(),
    );

    expect(score.status).toBe("PASS");
    expect(score.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it.each([
    ["decision", { decision: "REJECT" }],
    ["downstreamEligibility", { eligibleForDownstreamProcessing: false }],
    [
      "understandability",
      { understandability: { status: "NONSENSE", reason: "" } },
    ],
    [
      "softwareRelated",
      { softwareValidity: { isSoftwareRelated: false } },
    ],
    [
      "realProblem",
      { softwareValidity: { hasRealQuestionOrProblem: false } },
    ],
    ["intent", { softwareValidity: { intent: "ARCHITECTURE" } }],
    ["answerability", { answerability: { status: "NOT_ANSWERABLE" } }],
    [
      "promptInjectionRisk",
      { security: { promptInjectionRisk: "HIGH" } },
    ],
    [
      "suspiciousInstruction",
      { security: { hasSuspiciousInstructionalText: true } },
    ],
    [
      "harmfulTechnicalIntent",
      { security: { harmfulTechnicalIntent: "MALWARE" } },
    ],
  ] as const)("reports %s mismatches", (name, resultOverrides) => {
    const score = scoreQuestionEligibilityCase(
      createQuestionEligibilityEvalCase().expected,
      createEligibilityResult(resultOverrides),
    );

    expect(score.status).toBe("QUALITY_FAILURE");
    expect(score.assertions.find((assertion) => assertion.name === name)).toMatchObject({
      passed: false,
    });
  });

  it("accepts multiple understandability statuses and harmful intents", () => {
    const testCase = createQuestionEligibilityEvalCase({
      expected: {
        ...createQuestionEligibilityEvalCase().expected,
        understandability: {
          acceptableStatuses: ["UNDERSTANDABLE", "AMBIGUOUS_BUT_USABLE"],
        },
        security: {
          ...createQuestionEligibilityEvalCase().expected.security,
          acceptableHarmfulTechnicalIntents: ["NONE", "CYBER_DUAL_USE"],
        },
      },
    });

    const score = scoreQuestionEligibilityCase(
      testCase.expected,
      createEligibilityResult({
        security: {
          ...createEligibilityResult().security,
          harmfulTechnicalIntent: "CYBER_DUAL_USE",
        },
      }),
    );

    expect(score.status).toBe("PASS");
  });

  it("uses containment semantics for questionable entities", () => {
    const testCase = createQuestionEligibilityEvalCase({
      expected: {
        ...createQuestionEligibilityEvalCase().expected,
        softwareValidity: {
          ...createQuestionEligibilityEvalCase().expected.softwareValidity,
          expectedQuestionableEntities: ["React 999", "useServerQuantumState()"],
        },
      },
    });

    const score = scoreQuestionEligibilityCase(
      testCase.expected,
      createEligibilityResult({
        softwareValidity: {
          ...createEligibilityResult().softwareValidity,
          questionableEntities: ["React 999", "`useServerQuantumState`", "Extra"],
        },
      }),
    );

    expect(score.status).toBe("PASS");
  });

  it("returns execution failure without semantic assertions", () => {
    expect(
      scoreQuestionEligibilityCase(
        createQuestionEligibilityEvalCase().expected,
        createEligibilityFailure(),
      ),
    ).toEqual({ status: "EXECUTION_FAILURE", assertions: [] });
  });
});
