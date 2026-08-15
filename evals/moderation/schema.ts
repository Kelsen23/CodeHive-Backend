import z from "zod";

const moderationActionSchema = z.enum([
  "IGNORE",
  "WARN",
  "BAN_TEMP",
  "BAN_PERM",
]);

const moderationEvalQuestionInputSchema = z
  .object({
    contentType: z.literal("QUESTION"),
    title: z.string(),
    body: z.string(),
  })
  .strict();

const moderationEvalAnswerInputSchema = z
  .object({
    contentType: z.literal("ANSWER"),
    body: z.string(),
  })
  .strict();

const moderationEvalReplyInputSchema = z
  .object({
    contentType: z.literal("REPLY"),
    body: z.string(),
  })
  .strict();

const moderationEvalFeedbackInputSchema = z
  .object({
    contentType: z.literal("AI_ANSWER_FEEDBACK"),
    body: z.string(),
  })
  .strict();

const moderationEvalInputSchema = z.discriminatedUnion("contentType", [
  moderationEvalQuestionInputSchema,
  moderationEvalAnswerInputSchema,
  moderationEvalReplyInputSchema,
  moderationEvalFeedbackInputSchema,
]);

const moderationEvalExpectedSchema = z
  .object({
    flagged: z.boolean(),
    acceptableCategories: z.array(z.string().min(1)).min(1).optional(),
    acceptableActions: z.array(moderationActionSchema).min(1).optional(),
  })
  .strict();

const moderationEvalCaseSchema = z
  .object({
    id: z.string().trim().min(1, "Case id is required"),
    description: z.string().trim().min(1, "Case description is required"),
    input: moderationEvalInputSchema,
    expected: moderationEvalExpectedSchema,
    tags: z
      .array(z.string().trim().min(1))
      .min(1, "At least one tag is required")
      .refine((tags) => new Set(tags).size === tags.length, {
        message: "Tags must be unique",
      }),
  })
  .strict();

const moderationEvalCaseSetSchema = z.array(moderationEvalCaseSchema);

type ModerationAction = z.infer<typeof moderationActionSchema>;
type ModerationEvalInput = z.infer<typeof moderationEvalInputSchema>;
type ModerationEvalExpected = z.infer<typeof moderationEvalExpectedSchema>;
type ModerationEvalCase = z.infer<typeof moderationEvalCaseSchema>;
type ModerationEvalCaseSet = z.infer<typeof moderationEvalCaseSetSchema>;

export {
  moderationActionSchema,
  moderationEvalInputSchema,
  moderationEvalExpectedSchema,
  moderationEvalCaseSchema,
  moderationEvalCaseSetSchema,
};

export type {
  ModerationAction,
  ModerationEvalInput,
  ModerationEvalExpected,
  ModerationEvalCase,
  ModerationEvalCaseSet,
};
