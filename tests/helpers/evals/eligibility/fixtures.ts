import type { QuestionEligibilityGateResult } from "../../../../src/validations/question/eligibilityGate.schema.js";

import type { QuestionEligibilityEvalCase } from "../../../../evals/eligibility/schema.js";

type DeepPartial<T> = T extends object
  ? { [Key in keyof T]?: DeepPartial<T[Key]> }
  : T;

const createQuestionEligibilityEvalCase = (
  overrides: Partial<QuestionEligibilityEvalCase> = {},
): QuestionEligibilityEvalCase => ({
  id: "eligibility-fixture-1",
  description: "A deterministic eligibility eval case",
  input: {
    title: "How do I fix this TypeScript error?",
    body: "The compiler reports an error and I need help understanding it.",
    tags: ["TYPESCRIPT"],
  },
  expected: {
    decision: "ALLOW",
    eligibleForDownstreamProcessing: true,
    understandability: { acceptableStatuses: ["UNDERSTANDABLE"] },
    softwareValidity: {
      isSoftwareRelated: true,
      hasRealQuestionOrProblem: true,
      acceptableIntents: ["DEBUGGING"],
    },
    answerability: { status: "ANSWERABLE" },
    security: {
      acceptablePromptInjectionRisks: ["NONE"],
      hasSuspiciousInstructionalText: false,
      acceptableHarmfulTechnicalIntents: ["NONE"],
    },
  },
  tags: ["fixture"],
  ...overrides,
});

const createEligibilityResult = (
  overrides: DeepPartial<QuestionEligibilityGateResult> = {},
): QuestionEligibilityGateResult => ({
  decision: "ALLOW",
  eligibleForDownstreamProcessing: true,
  understandability: {
    status: "UNDERSTANDABLE",
    reason: "Fixture reason",
  },
  softwareValidity: {
    isSoftwareRelated: true,
    hasRealQuestionOrProblem: true,
    intent: "DEBUGGING",
    technologies: ["TypeScript"],
    questionableEntities: [],
  },
  answerability: {
    status: "ANSWERABLE",
    missingContext: [],
  },
  security: {
    promptInjectionRisk: "NONE",
    hasSuspiciousInstructionalText: false,
    harmfulTechnicalIntent: "NONE",
    reason: "Fixture security reason",
  },
  userFacingReason: "Fixture user-facing reason",
  internalReason: "Fixture internal reason",
  ...overrides,
  understandability: {
    status: "UNDERSTANDABLE",
    reason: "Fixture reason",
    ...overrides.understandability,
  },
  softwareValidity: {
    isSoftwareRelated: true,
    hasRealQuestionOrProblem: true,
    intent: "DEBUGGING",
    technologies: ["TypeScript"],
    questionableEntities: [],
    ...overrides.softwareValidity,
  },
  answerability: {
    status: "ANSWERABLE",
    missingContext: [],
    ...overrides.answerability,
  },
  security: {
    promptInjectionRisk: "NONE",
    hasSuspiciousInstructionalText: false,
    harmfulTechnicalIntent: "NONE",
    reason: "Fixture security reason",
    ...overrides.security,
  },
});

const createEligibilityFailure = (
  error = "Fixture eligibility failure",
) => ({
  ok: false as const,
  error,
});

export {
  createEligibilityFailure,
  createEligibilityResult,
  createQuestionEligibilityEvalCase,
};
