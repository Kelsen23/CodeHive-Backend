import z from "zod";

const questionEligibilityGateSchema = z
  .object({
    decision: z.enum(["ALLOW", "CLARIFY", "REJECT"]),
    eligibleForDownstreamProcessing: z.boolean(),
    understandability: z
      .object({
        status: z.enum([
          "UNDERSTANDABLE",
          "AMBIGUOUS_BUT_USABLE",
          "TOO_VAGUE",
          "FRAGMENTED",
          "NONSENSE",
        ]),
        reason: z.string(),
      })
      .strict(),
    softwareValidity: z
      .object({
        isSoftwareRelated: z.boolean(),
        hasRealQuestionOrProblem: z.boolean(),
        intent: z.enum([
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
        ]),
        technologies: z.array(z.string()),
        questionableEntities: z.array(z.string()),
      })
      .strict(),
    answerability: z
      .object({
        status: z.enum(["ANSWERABLE", "NEEDS_CLARIFICATION", "NOT_ANSWERABLE"]),
        missingContext: z.array(z.string()),
      })
      .strict(),
    security: z
      .object({
        promptInjectionRisk: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
        hasSuspiciousInstructionalText: z.boolean(),
        harmfulTechnicalIntent: z.enum([
          "NONE",
          "CYBER_DUAL_USE",
          "CREDENTIAL_THEFT",
          "MALWARE",
          "ABUSE_EVASION",
          "PRIVACY_INVASION",
          "UNKNOWN",
        ]),
        reason: z.string(),
      })
      .strict(),
    userFacingReason: z.string(),
    internalReason: z.string(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedEligibility = value.decision === "ALLOW";

    if (value.eligibleForDownstreamProcessing !== expectedEligibility) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eligibleForDownstreamProcessing"],
        message:
          "eligibleForDownstreamProcessing must be true only when decision is allow",
      });
    }

    if (
      value.answerability.status === "ANSWERABLE" &&
      value.answerability.missingContext.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answerability", "missingContext"],
        message: "answerable results cannot list missing context",
      });
    }

    if (
      value.decision === "ALLOW" &&
      value.security.promptInjectionRisk === "HIGH"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["security", "promptInjectionRisk"],
        message: "allow decisions cannot have high prompt injection risk",
      });
    }

    if (
      value.decision === "ALLOW" &&
      value.security.harmfulTechnicalIntent !== "NONE"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["security", "harmfulTechnicalIntent"],
        message: "allow decisions cannot have harmful technical intent",
      });
    }
  });

export { questionEligibilityGateSchema };

export type QuestionEligibilityGateResult = z.infer<
  typeof questionEligibilityGateSchema
>;
