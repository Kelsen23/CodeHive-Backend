import { describe, expect, it } from "vitest";

import {
  createSecurityEvalCase,
  createSecurityFailure,
  createSecurityResult,
} from "../../../helpers/evals/security/fixtures.js";
import { scoreSecurityCase } from "../../../../evals/security/score.js";

describe("scoreSecurityCase", () => {
  it("passes a fully matching result", () => {
    const score = scoreSecurityCase(
      createSecurityEvalCase().expected,
      createSecurityResult(),
    );

    expect(score.status).toBe("PASS");
    expect(score.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it.each([
    ["finalSecurityDecision", { finalSecurityDecision: "REJECT" }],
    [
      "downstreamEligibility",
      { downstreamPolicy: { eligibleForDownstreamProcessing: false } },
    ],
    ["promptInjectionDetected", { promptInjection: { detected: true } }],
    ["promptInjectionRisk", { promptInjection: { risk: "HIGH" } }],
    [
      "promptInjectionAttackType",
      { promptInjection: { attackType: "TOOL_ABUSE" } },
    ],
    ["harmfulIntentDetected", { harmfulTechnicalIntent: { detected: true } }],
    [
      "harmfulIntentCategory",
      { harmfulTechnicalIntent: { category: "MALWARE" } },
    ],
    ["harmfulIntentSeverity", { harmfulTechnicalIntent: { severity: "HIGH" } }],
    [
      "defensiveFraming",
      { downstreamPolicy: { requireDefensiveFraming: true } },
    ],
    [
      "quotedTextIsolation",
      { downstreamPolicy: { requireQuotedTextIsolation: true } },
    ],
  ] as const)("reports %s mismatches", (name, overrides) => {
    const score = scoreSecurityCase(
      createSecurityEvalCase().expected,
      createSecurityResult(overrides),
    );

    expect(score.status).toBe("QUALITY_FAILURE");
    expect(
      score.assertions.find((assertion) => assertion.name === name),
    ).toMatchObject({
      passed: false,
    });
  });

  it("accepts multiple taxonomy alternatives", () => {
    const expected = createSecurityEvalCase({
      expected: {
        ...createSecurityEvalCase().expected,
        finalSecurityDecision: "ALLOW_WITH_CONSTRAINTS",
        promptInjection: {
          detected: true,
          acceptableRisks: ["LOW", "MEDIUM"],
          acceptableAttackTypes: ["QUOTED_UNTRUSTED_TEXT", "OTHER"],
        },
        harmfulTechnicalIntent: {
          detected: false,
          acceptableCategories: ["NONE", "CYBER_DUAL_USE"],
          acceptableSeverities: ["NONE", "LOW"],
        },
        downstreamPolicy: {
          eligibleForDownstreamProcessing: true,
          requireDefensiveFraming: true,
          requireQuotedTextIsolation: true,
        },
      },
    });

    const score = scoreSecurityCase(
      expected.expected,
      createSecurityResult({
        finalSecurityDecision: "ALLOW_WITH_CONSTRAINTS",
        promptInjection: {
          detected: true,
          risk: "MEDIUM",
          attackType: "OTHER",
          suspiciousText: ["quoted instruction"],
        },
        downstreamPolicy: {
          eligibleForDownstreamProcessing: true,
          requireDefensiveFraming: true,
          requireQuotedTextIsolation: true,
        },
      }),
    );

    expect(score.status).toBe("PASS");
  });

  it("returns execution failure without assertions", () => {
    expect(
      scoreSecurityCase(
        createSecurityEvalCase().expected,
        createSecurityFailure(),
      ),
    ).toEqual({ status: "EXECUTION_FAILURE", assertions: [] });
  });
});
