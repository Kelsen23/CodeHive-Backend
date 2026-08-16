import z from "zod";

const eligibilityDecisionSchema = z.enum(["ALLOW", "CLARIFY", "REJECT"]);

const understandabilityStatusSchema = z.enum([
  "UNDERSTANDABLE",
  "AMBIGUOUS_BUT_USABLE",
  "TOO_VAGUE",
  "FRAGMENTED",
  "NONSENSE",
]);

const softwareIntentSchema = z.enum([
  "DEBUGGING",
  "IMPLEMENTATION",
  "ARCHITECTURE",
  "CONCEPTUAL_EXPLANATION",
  "TOOLING_CONFIG",
  "ERROR_EXPLANATION",
  "CODE_REVIEW",
  "NON_SOFTWARE",
  "NO_REAL_PROBLEM",
  "UNKNOWN",
]);

const answerabilityStatusSchema = z.enum([
  "ANSWERABLE",
  "NEEDS_CLARIFICATION",
  "NOT_ANSWERABLE",
]);

const promptInjectionRiskSchema = z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]);

const harmfulTechnicalIntentSchema = z.enum([
  "NONE",
  "CYBER_DUAL_USE",
  "CREDENTIAL_THEFT",
  "MALWARE",
  "ABUSE_EVASION",
  "PRIVACY_INVASION",
  "UNKNOWN",
]);

const questionEligibilityEvalInputSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    tags: z.array(z.string()),
  })
  .strict();

const questionEligibilityEvalExpectedSchema = z
  .object({
    decision: eligibilityDecisionSchema,
    eligibleForDownstreamProcessing: z.boolean(),
    understandability: z
      .object({
        acceptableStatuses: z
          .array(understandabilityStatusSchema)
          .min(1)
          .refine((statuses) => new Set(statuses).size === statuses.length, {
            message: "Accepted understandability statuses must be unique",
          }),
      })
      .strict(),
    softwareValidity: z
      .object({
        isSoftwareRelated: z.boolean(),
        hasRealQuestionOrProblem: z.boolean(),
        acceptableIntents: z
          .array(softwareIntentSchema)
          .min(1)
          .refine((intents) => new Set(intents).size === intents.length, {
            message: "Accepted software intents must be unique",
          }),
        expectedQuestionableEntities: z
          .array(z.string().trim().min(1))
          .min(1)
          .refine((entities) => new Set(entities).size === entities.length, {
            message: "Expected questionable entities must be unique",
          })
          .optional(),
      })
      .strict(),
    answerability: z
      .object({
        status: answerabilityStatusSchema,
      })
      .strict(),
    security: z
      .object({
        acceptablePromptInjectionRisks: z
          .array(promptInjectionRiskSchema)
          .min(1)
          .refine((risks) => new Set(risks).size === risks.length, {
            message: "Accepted prompt-injection risks must be unique",
          }),
        hasSuspiciousInstructionalText: z.boolean(),
        acceptableHarmfulTechnicalIntents: z
          .array(harmfulTechnicalIntentSchema)
          .min(1)
          .refine((intents) => new Set(intents).size === intents.length, {
            message: "Accepted harmful technical intents must be unique",
          }),
      })
      .strict(),
  })
  .strict();

const questionEligibilityEvalCaseSchema = z
  .object({
    id: z.string().trim().min(1, "Case id is required"),
    description: z.string().trim().min(1, "Case description is required"),
    input: questionEligibilityEvalInputSchema,
    expected: questionEligibilityEvalExpectedSchema,
    tags: z
      .array(z.string().trim().min(1))
      .min(1, "At least one tag is required")
      .refine((tags) => new Set(tags).size === tags.length, {
        message: "Tags must be unique",
      }),
  })
  .strict();

const questionEligibilityEvalCaseSetSchema = z.array(
  questionEligibilityEvalCaseSchema,
);

type EligibilityDecision = z.infer<typeof eligibilityDecisionSchema>;
type UnderstandabilityStatus = z.infer<typeof understandabilityStatusSchema>;
type SoftwareIntent = z.infer<typeof softwareIntentSchema>;
type AnswerabilityStatus = z.infer<typeof answerabilityStatusSchema>;
type PromptInjectionRisk = z.infer<typeof promptInjectionRiskSchema>;
type HarmfulTechnicalIntent = z.infer<typeof harmfulTechnicalIntentSchema>;
type QuestionEligibilityEvalInput = z.infer<
  typeof questionEligibilityEvalInputSchema
>;
type QuestionEligibilityEvalExpected = z.infer<
  typeof questionEligibilityEvalExpectedSchema
>;
type QuestionEligibilityEvalCase = z.infer<
  typeof questionEligibilityEvalCaseSchema
>;
type QuestionEligibilityEvalCaseSet = z.infer<
  typeof questionEligibilityEvalCaseSetSchema
>;

export {
  eligibilityDecisionSchema,
  understandabilityStatusSchema,
  softwareIntentSchema,
  answerabilityStatusSchema,
  promptInjectionRiskSchema,
  harmfulTechnicalIntentSchema,
  questionEligibilityEvalInputSchema,
  questionEligibilityEvalExpectedSchema,
  questionEligibilityEvalCaseSchema,
  questionEligibilityEvalCaseSetSchema,
};

export type {
  EligibilityDecision,
  UnderstandabilityStatus,
  SoftwareIntent,
  AnswerabilityStatus,
  PromptInjectionRisk,
  HarmfulTechnicalIntent,
  QuestionEligibilityEvalInput,
  QuestionEligibilityEvalExpected,
  QuestionEligibilityEvalCase,
  QuestionEligibilityEvalCaseSet,
};
