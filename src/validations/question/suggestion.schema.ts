import z from "zod";

import { Interest } from "../../generated/prisma/client.js";

const questionSuggestionTipCategorySchema = z.enum([
  "MISSING_CODE",
  "MISSING_ERROR",
  "MISSING_CONTEXT",
  "MISSING_REPRODUCTION",
  "MISSING_EXPECTED_BEHAVIOR",
  "MISSING_ACTUAL_BEHAVIOR",
  "MISSING_ENVIRONMENT",
  "CLARITY",
  "SCOPE",
  "FORMATTING",
  "OTHER",
]);

const questionSuggestionSchema = z
  .object({
    suggestedTitle: z
      .string()
      .trim()
      .min(10, "Title must be at least 10 characters")
      .max(150, "Title must be at most 150 characters"),
    suggestedBody: z
      .string()
      .trim()
      .min(20, "Body must be at least 20 characters")
      .max(20000, "Body must be at most 20000 characters"),
    suggestedTags: z
      .array(z.nativeEnum(Interest))
      .max(5, "At most five tags are allowed"),
    improvementTips: z
      .array(
        z
          .object({
            category: questionSuggestionTipCategorySchema,
            message: z
              .string()
              .trim()
              .min(1, "Improvement tip message is required"),
          })
          .strict(),
      )
      .max(3, "At most three improvement tips are allowed"),
  })
  .strict();

type QuestionSuggestionResult = z.infer<typeof questionSuggestionSchema>;
type QuestionSuggestionTipCategory = z.infer<
  typeof questionSuggestionTipCategorySchema
>;

export { questionSuggestionSchema, questionSuggestionTipCategorySchema };
export type { QuestionSuggestionResult, QuestionSuggestionTipCategory };
