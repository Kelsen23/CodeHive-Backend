import z from "zod";

const securityDecisionSchema = z.enum([
  "ALLOW",
  "ALLOW_WITH_CONSTRAINTS",
  "REJECT",
]);

const promptInjectionRiskSchema = z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]);

const promptInjectionAttackTypeSchema = z.enum([
  "NONE",
  "DIRECT_INSTRUCTION_OVERRIDE",
  "SYSTEM_PROMPT_EXTRACTION",
  "ROLEPLAY_JAILBREAK",
  "DEVELOPER_MODE",
  "HIDDEN_OR_ENCODED_INSTRUCTION",
  "TOOL_ABUSE",
  "DATA_EXFILTRATION",
  "QUOTED_UNTRUSTED_TEXT",
  "INDIRECT_PROMPT_INJECTION",
  "OTHER",
]);

const harmfulTechnicalIntentCategorySchema = z.enum([
  "NONE",
  "MALWARE",
  "CREDENTIAL_THEFT",
  "PHISHING",
  "ABUSE_EVASION",
  "UNAUTHORIZED_ACCESS",
  "PRIVACY_INVASION",
  "SPAM_OR_PLATFORM_ABUSE",
  "DESTRUCTIVE_ACTION",
  "CYBER_DUAL_USE",
  "OTHER",
]);

const harmfulTechnicalIntentSeveritySchema = z.enum([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
]);

const uniqueAcceptedValues = <T extends z.ZodType>(schema: T, name: string) =>
  z
    .array(schema)
    .min(1)
    .refine((values) => new Set(values).size === values.length, {
      message: `${name} must be unique`,
    });

const securityEvalInputSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    tags: z.array(z.string()),
  })
  .strict();

const securityEvalExpectedSchema = z
  .object({
    finalSecurityDecision: securityDecisionSchema,
    promptInjection: z
      .object({
        detected: z.boolean(),
        acceptableRisks: uniqueAcceptedValues(
          promptInjectionRiskSchema,
          "Accepted prompt-injection risks",
        ),
        acceptableAttackTypes: uniqueAcceptedValues(
          promptInjectionAttackTypeSchema,
          "Accepted prompt-injection attack types",
        ),
      })
      .strict(),
    harmfulTechnicalIntent: z
      .object({
        detected: z.boolean(),
        acceptableCategories: uniqueAcceptedValues(
          harmfulTechnicalIntentCategorySchema,
          "Accepted harmful-intent categories",
        ),
        acceptableSeverities: uniqueAcceptedValues(
          harmfulTechnicalIntentSeveritySchema,
          "Accepted harmful-intent severities",
        ),
      })
      .strict(),
    downstreamPolicy: z
      .object({
        eligibleForDownstreamProcessing: z.boolean(),
        requireDefensiveFraming: z.boolean(),
        requireQuotedTextIsolation: z.boolean(),
      })
      .strict(),
  })
  .strict();

const securityEvalCaseSchema = z
  .object({
    id: z.string().trim().min(1, "Case id is required"),
    description: z.string().trim().min(1, "Case description is required"),
    input: securityEvalInputSchema,
    expected: securityEvalExpectedSchema,
    tags: z
      .array(z.string().trim().min(1))
      .min(1, "At least one tag is required")
      .refine((tags) => new Set(tags).size === tags.length, {
        message: "Tags must be unique",
      }),
  })
  .strict();

const securityEvalCaseSetSchema = z.array(securityEvalCaseSchema);

type SecurityDecision = z.infer<typeof securityDecisionSchema>;
type PromptInjectionRisk = z.infer<typeof promptInjectionRiskSchema>;
type PromptInjectionAttackType = z.infer<
  typeof promptInjectionAttackTypeSchema
>;
type HarmfulTechnicalIntentCategory = z.infer<
  typeof harmfulTechnicalIntentCategorySchema
>;
type HarmfulTechnicalIntentSeverity = z.infer<
  typeof harmfulTechnicalIntentSeveritySchema
>;
type SecurityEvalInput = z.infer<typeof securityEvalInputSchema>;
type SecurityEvalExpected = z.infer<typeof securityEvalExpectedSchema>;
type SecurityEvalCase = z.infer<typeof securityEvalCaseSchema>;
type SecurityEvalCaseSet = z.infer<typeof securityEvalCaseSetSchema>;

export {
  securityDecisionSchema,
  promptInjectionRiskSchema,
  promptInjectionAttackTypeSchema,
  harmfulTechnicalIntentCategorySchema,
  harmfulTechnicalIntentSeveritySchema,
  securityEvalInputSchema,
  securityEvalExpectedSchema,
  securityEvalCaseSchema,
  securityEvalCaseSetSchema,
};

export type {
  SecurityDecision,
  PromptInjectionRisk,
  PromptInjectionAttackType,
  HarmfulTechnicalIntentCategory,
  HarmfulTechnicalIntentSeverity,
  SecurityEvalInput,
  SecurityEvalExpected,
  SecurityEvalCase,
  SecurityEvalCaseSet,
};
