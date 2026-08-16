import type { QuestionEligibilityGateResult } from "../../src/validations/question.schema.js";

import type { QuestionEligibilityEvalExpected } from "./schema.js";

type EligibilityEvalCaseStatus =
  | "PASS"
  | "QUALITY_FAILURE"
  | "EXECUTION_FAILURE";

type EligibilityAssertionName =
  | "decision"
  | "downstreamEligibility"
  | "understandability"
  | "softwareRelated"
  | "realProblem"
  | "intent"
  | "questionableEntities"
  | "answerability"
  | "promptInjectionRisk"
  | "suspiciousInstruction"
  | "harmfulTechnicalIntent";

type EligibilityAssertionResult = {
  name: EligibilityAssertionName;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};

type EligibilityEvalExecutionFailure = {
  ok: false;
  error: string;
};

type EligibilityEvalActualResult =
  | QuestionEligibilityGateResult
  | EligibilityEvalExecutionFailure;

type EligibilityCaseScore = {
  status: EligibilityEvalCaseStatus;
  assertions: EligibilityAssertionResult[];
};

const normalizeEntity = (entity: string) =>
  entity
    .trim()
    .toLowerCase()
    .replace(/^`+|`+$/g, "")
    .replace(/\(\)$/, "")
    .replace(/[.,;:!?]+$/, "");

const containsExpectedEntities = (
  expectedEntities: string[],
  actualEntities: string[],
) => {
  const normalizedActualEntities = new Set(actualEntities.map(normalizeEntity));

  return expectedEntities.every((entity) =>
    normalizedActualEntities.has(normalizeEntity(entity)),
  );
};

const isExecutionFailure = (
  result: EligibilityEvalActualResult,
): result is EligibilityEvalExecutionFailure =>
  "ok" in result && result.ok === false;

const scoreQuestionEligibilityCase = (
  expected: QuestionEligibilityEvalExpected,
  result: EligibilityEvalActualResult,
): EligibilityCaseScore => {
  if (isExecutionFailure(result)) {
    return {
      status: "EXECUTION_FAILURE",
      assertions: [],
    };
  }

  const assertions: EligibilityAssertionResult[] = [
    {
      name: "decision",
      passed: result.decision === expected.decision,
      expected: expected.decision,
      actual: result.decision,
    },
    {
      name: "downstreamEligibility",
      passed:
        result.eligibleForDownstreamProcessing ===
        expected.eligibleForDownstreamProcessing,
      expected: expected.eligibleForDownstreamProcessing,
      actual: result.eligibleForDownstreamProcessing,
    },
    {
      name: "understandability",
      passed: expected.understandability.acceptableStatuses.includes(
        result.understandability.status,
      ),
      expected: expected.understandability.acceptableStatuses,
      actual: result.understandability.status,
    },
    {
      name: "softwareRelated",
      passed:
        result.softwareValidity.isSoftwareRelated ===
        expected.softwareValidity.isSoftwareRelated,
      expected: expected.softwareValidity.isSoftwareRelated,
      actual: result.softwareValidity.isSoftwareRelated,
    },
    {
      name: "realProblem",
      passed:
        result.softwareValidity.hasRealQuestionOrProblem ===
        expected.softwareValidity.hasRealQuestionOrProblem,
      expected: expected.softwareValidity.hasRealQuestionOrProblem,
      actual: result.softwareValidity.hasRealQuestionOrProblem,
    },
    {
      name: "intent",
      passed: expected.softwareValidity.acceptableIntents.includes(
        result.softwareValidity.intent,
      ),
      expected: expected.softwareValidity.acceptableIntents,
      actual: result.softwareValidity.intent,
    },
    {
      name: "answerability",
      passed: result.answerability.status === expected.answerability.status,
      expected: expected.answerability.status,
      actual: result.answerability.status,
    },
    {
      name: "promptInjectionRisk",
      passed: expected.security.acceptablePromptInjectionRisks.includes(
        result.security.promptInjectionRisk,
      ),
      expected: expected.security.acceptablePromptInjectionRisks,
      actual: result.security.promptInjectionRisk,
    },
    {
      name: "suspiciousInstruction",
      passed:
        result.security.hasSuspiciousInstructionalText ===
        expected.security.hasSuspiciousInstructionalText,
      expected: expected.security.hasSuspiciousInstructionalText,
      actual: result.security.hasSuspiciousInstructionalText,
    },
    {
      name: "harmfulTechnicalIntent",
      passed: expected.security.acceptableHarmfulTechnicalIntents.includes(
        result.security.harmfulTechnicalIntent,
      ),
      expected: expected.security.acceptableHarmfulTechnicalIntents,
      actual: result.security.harmfulTechnicalIntent,
    },
  ];

  if (expected.softwareValidity.expectedQuestionableEntities) {
    assertions.push({
      name: "questionableEntities",
      passed: containsExpectedEntities(
        expected.softwareValidity.expectedQuestionableEntities,
        result.softwareValidity.questionableEntities,
      ),
      expected: expected.softwareValidity.expectedQuestionableEntities,
      actual: result.softwareValidity.questionableEntities,
    });
  }

  return {
    status: assertions.every(({ passed }) => passed)
      ? "PASS"
      : "QUALITY_FAILURE",
    assertions,
  };
};

export type {
  EligibilityEvalCaseStatus,
  EligibilityAssertionName,
  EligibilityAssertionResult,
  EligibilityEvalExecutionFailure,
  EligibilityEvalActualResult,
  EligibilityCaseScore,
};

export { scoreQuestionEligibilityCase };
