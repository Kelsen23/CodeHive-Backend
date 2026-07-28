import z from "zod";

const securityVerifierSchema = z
  .object({
    finalSecurityDecision: z.enum([
      "ALLOW",
      "ALLOW_WITH_CONSTRAINTS",
      "REJECT",
    ]),
    promptInjection: z
      .object({
        detected: z.boolean(),
        risk: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
        attackType: z.enum([
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
        ]),
        suspiciousText: z.array(z.string()),
      })
      .strict(),
    harmfulTechnicalIntent: z
      .object({
        detected: z.boolean(),
        category: z.enum([
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
        ]),
        severity: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
      })
      .strict(),
    downstreamPolicy: z
      .object({
        eligibleForDownstreamProcessing: z.boolean(),
        requireDefensiveFraming: z.boolean(),
        requireQuotedTextIsolation: z.boolean(),
      })
      .strict(),
    userFacingReason: z.string(),
    internalReason: z.string(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedEligibility = value.finalSecurityDecision !== "REJECT";

    if (
      value.downstreamPolicy.eligibleForDownstreamProcessing !==
      expectedEligibility
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["downstreamPolicy", "eligibleForDownstreamProcessing"],
        message:
          "eligibleForDownstreamProcessing must be false only when finalSecurityDecision is reject",
      });
    }

    if (
      value.finalSecurityDecision === "ALLOW" &&
      (value.downstreamPolicy.requireDefensiveFraming ||
        value.downstreamPolicy.requireQuotedTextIsolation)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["downstreamPolicy"],
        message: "allow decisions cannot require downstream constraints",
      });
    }

    if (
      value.finalSecurityDecision === "ALLOW_WITH_CONSTRAINTS" &&
      (!value.downstreamPolicy.requireDefensiveFraming ||
        !value.downstreamPolicy.requireQuotedTextIsolation)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["downstreamPolicy"],
        message:
          "allow_with_constraints decisions must require defensive framing and quoted-text isolation",
      });
    }
  });

export { securityVerifierSchema };

export type SecurityVerifierResult = z.infer<typeof securityVerifierSchema>;
