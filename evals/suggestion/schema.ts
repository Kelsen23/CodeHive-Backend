import z from "zod";

import { Interest } from "../../src/generated/prisma/client.js";
import { questionSuggestionTipCategorySchema } from "../../src/validations/question/suggestion.schema.js";

const uniqueArray = <T extends z.ZodTypeAny>(schema: T, name: string) =>
  z.array(schema).refine((values) => new Set(values).size === values.length, {
    message: `${name} must be unique`,
  });

const uniqueStringArray = (name: string) =>
  uniqueArray(z.string().trim().min(1), name);

const uniqueInterestArray = (name: string) =>
  uniqueArray(z.nativeEnum(Interest), name);

const uniqueTipCategoryArray = (name: string) =>
  uniqueArray(questionSuggestionTipCategorySchema, name);

const suggestionEvalInputSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    tags: z.array(z.string()),
    securityVerifierStatus: z.unknown().optional(),
    eligibilityGateDiagnosis: z.unknown().optional(),
  })
  .strict();

const suggestionEvalAssertionsSchema = z
  .object({
    mustPreserve: uniqueStringArray("Required evidence").optional(),
    mustPreserveVerbatim: uniqueStringArray(
      "Required verbatim evidence",
    ).optional(),
    mustNotContain: uniqueStringArray("Forbidden literal output").optional(),
    mustNotPreserve: uniqueStringArray(
      "Forbidden preserved content",
    ).optional(),
    requiredTags: uniqueInterestArray("Required tags").optional(),
    forbiddenTags: uniqueInterestArray("Forbidden tags").optional(),
    requiredTipCategories: uniqueTipCategoryArray(
      "Required tip categories",
    ).optional(),
    allowedTipCategories: uniqueTipCategoryArray(
      "Allowed tip categories",
    ).optional(),
    forbiddenTipCategories: uniqueTipCategoryArray(
      "Forbidden tip categories",
    ).optional(),
    expectNoTips: z.boolean().optional(),
    suggestedBodyMaxLength: z.number().int().min(0).optional(),
    tipCount: z
      .object({
        min: z.number().int().min(0).optional(),
        max: z.number().int().min(0).optional(),
      })
      .strict()
      .refine(({ min, max }) => min !== undefined || max !== undefined, {
        message: "Tip count must define a minimum or maximum",
      })
      .refine(
        ({ min, max }) => min === undefined || max === undefined || min <= max,
        { message: "Tip count minimum cannot exceed maximum" },
      )
      .optional(),
    noInventedFacts: z.boolean().optional(),
    noDiagnosisOrSolution: z.boolean().optional(),
    preserveMeaning: z.boolean().optional(),
    preserveUncertainty: z.boolean().optional(),
    tipsOnlyForMissingInformation: z.boolean().optional(),
  })
  .strict()
  .superRefine((assertions, ctx) => {
    const addOverlapIssue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    };

    const hasActiveAssertion = Object.entries(assertions).some(
      ([key, value]) => {
        if (value === undefined) return false;
        if (key === "expectNoTips") return true;
        if (typeof value === "boolean") return value;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      },
    );

    if (!hasActiveAssertion) {
      addOverlapIssue(
        [],
        "Each suggestion eval case must define at least one active assertion",
      );
    }

    const mustPreserve = new Set(assertions.mustPreserve ?? []);
    const mustNotPreserve = new Set(assertions.mustNotPreserve ?? []);
    if ([...mustPreserve].some((value) => mustNotPreserve.has(value))) {
      addOverlapIssue(
        ["mustNotPreserve"],
        "Required and forbidden preserved content must not overlap",
      );
    }

    const mustPreserveVerbatim = new Set(assertions.mustPreserveVerbatim ?? []);
    const mustNotContain = new Set(assertions.mustNotContain ?? []);
    if ([...mustPreserveVerbatim].some((value) => mustNotContain.has(value))) {
      addOverlapIssue(
        ["mustNotContain"],
        "Required verbatim evidence and forbidden literal output must not overlap",
      );
    }

    if ([...mustPreserve].some((value) => mustNotContain.has(value))) {
      addOverlapIssue(
        ["mustNotContain"],
        "Required evidence and forbidden literal output must not overlap",
      );
    }

    if ([...mustPreserveVerbatim].some((value) => mustNotPreserve.has(value))) {
      addOverlapIssue(
        ["mustNotPreserve"],
        "Required verbatim evidence and forbidden preserved content must not overlap",
      );
    }

    const requiredTags = new Set(assertions.requiredTags ?? []);
    const forbiddenTags = new Set(assertions.forbiddenTags ?? []);
    if ([...requiredTags].some((tag) => forbiddenTags.has(tag))) {
      addOverlapIssue(
        ["forbiddenTags"],
        "Required and forbidden tags must not overlap",
      );
    }

    const requiredTipCategories = new Set(
      assertions.requiredTipCategories ?? [],
    );
    const forbiddenTipCategories = new Set(
      assertions.forbiddenTipCategories ?? [],
    );
    if (
      [...requiredTipCategories].some((category) =>
        forbiddenTipCategories.has(category),
      )
    ) {
      addOverlapIssue(
        ["forbiddenTipCategories"],
        "Required and forbidden tip categories must not overlap",
      );
    }

    if (
      assertions.allowedTipCategories &&
      [...requiredTipCategories].some(
        (category) => !assertions.allowedTipCategories?.includes(category),
      )
    ) {
      addOverlapIssue(
        ["allowedTipCategories"],
        "Allowed tip categories must include every required tip category",
      );
    }

    if (assertions.expectNoTips && requiredTipCategories.size > 0) {
      addOverlapIssue(
        ["expectNoTips"],
        "expectNoTips cannot be combined with required tip categories",
      );
    }

    if (
      assertions.expectNoTips &&
      assertions.tipCount &&
      ((assertions.tipCount.min !== undefined && assertions.tipCount.min > 0) ||
        (assertions.tipCount.max !== undefined && assertions.tipCount.max > 0))
    ) {
      addOverlapIssue(
        ["tipCount"],
        "expectNoTips requires a tip count maximum of zero",
      );
    }

    if (assertions.expectNoTips === false && assertions.tipCount?.max === 0) {
      addOverlapIssue(
        ["tipCount", "max"],
        "expectNoTips false cannot be combined with a zero tip count maximum",
      );
    }

    if (
      assertions.tipCount?.max !== undefined &&
      assertions.tipCount.max === 0 &&
      requiredTipCategories.size > 0
    ) {
      addOverlapIssue(
        ["tipCount", "max"],
        "A zero tip count maximum cannot be combined with required tip categories",
      );
    }
  });

const suggestionEvalCaseSchema = z
  .object({
    id: z.string().trim().min(1, "Case id is required"),
    description: z.string().trim().min(1, "Case description is required"),
    input: suggestionEvalInputSchema,
    assertions: suggestionEvalAssertionsSchema,
    scenarioTags: uniqueStringArray("Scenario tags").min(
      1,
      "At least one scenario tag is required",
    ),
  })
  .strict();

const suggestionEvalCaseSetSchema = z.array(suggestionEvalCaseSchema);

const semanticJudgeCriterionSchema = z.enum([
  "noInventedFacts",
  "noDiagnosisOrSolution",
  "preserveMeaning",
  "preserveUncertainty",
  "preserveLanguage",
  "tipsOnlyForMissingInformation",
]);

const semanticJudgeJudgmentSchema = z
  .object({
    passed: z.boolean(),
    reason: z.string().trim().min(1),
  })
  .strict();

const suggestionSemanticJudgeResultSchema = z
  .object({
    caseId: z.string().trim().min(1),
    ...semanticJudgeJudgmentSchema.shape,
  })
  .strict();

const suggestionSemanticJudgeBatchSchema = z
  .object({
    judgments: z.array(suggestionSemanticJudgeResultSchema).min(1),
  })
  .strict()
  .superRefine((batch, ctx) => {
    const caseIds = batch.judgments.map(({ caseId }) => caseId);

    if (new Set(caseIds).size !== caseIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["judgments"],
        message: "Each suggestion case must appear exactly once per batch",
      });
    }
  });

type SuggestionEvalInput = z.infer<typeof suggestionEvalInputSchema>;
type SuggestionEvalAssertions = z.infer<typeof suggestionEvalAssertionsSchema>;
type SuggestionEvalCase = z.infer<typeof suggestionEvalCaseSchema>;
type SuggestionEvalCaseSet = z.infer<typeof suggestionEvalCaseSetSchema>;
type SemanticJudgeCriterion = z.infer<typeof semanticJudgeCriterionSchema>;
type SemanticJudgeJudgment = z.infer<typeof semanticJudgeJudgmentSchema>;
type SuggestionSemanticJudgeResult = z.infer<
  typeof suggestionSemanticJudgeResultSchema
>;
type SuggestionSemanticJudgeBatchResult = z.infer<
  typeof suggestionSemanticJudgeBatchSchema
>;

export {
  suggestionEvalInputSchema,
  suggestionEvalAssertionsSchema,
  suggestionEvalCaseSchema,
  suggestionEvalCaseSetSchema,
  semanticJudgeCriterionSchema,
  semanticJudgeJudgmentSchema,
  suggestionSemanticJudgeResultSchema,
  suggestionSemanticJudgeBatchSchema,
};

export type {
  SuggestionEvalInput,
  SuggestionEvalAssertions,
  SuggestionEvalCase,
  SuggestionEvalCaseSet,
  SemanticJudgeCriterion,
  SemanticJudgeJudgment,
  SuggestionSemanticJudgeResult,
  SuggestionSemanticJudgeBatchResult,
};
