import { createRequire } from "module";

import z from "zod";

import interests from "../utils/interests.js";

const require = createRequire(import.meta.url);
const leoProfanity = require("leo-profanity");

const createQuestionSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters"),
    body: z
      .string()
      .min(10, "Body must be at least 10 characters")
      .max(5000, "Body must be at most 5000 characters"),
    tags: z.array(z.string()).superRefine((arr, ctx) => {
      const invalid = arr.filter((i) => !interests.includes(i));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid interests: ${invalid.join(", ")}`,
        });
      }
    }),
  })
  .superRefine((data, ctx) => {
    if (leoProfanity.check(data.title)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Title contains inappropriate language",
      });
    }

    if (leoProfanity.check(data.body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Question contains inappropriate language",
      });
    }
  });

const createAnswerOnQuestionSchema = z
  .object({
    body: z
      .string()
      .min(10, "Answer must be at least 10 characters")
      .max(5000, "Answer must be at most 5000 characters"),
  })
  .superRefine((data, ctx) => {
    if (leoProfanity.check(data.body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Answer contains inappropriate language",
      });
    }
  });

const createReplyOnAnswerSchema = z
  .object({
    body: z
      .string()
      .min(1, "Reply must be at least 1 character")
      .max(2000, "Reply must be at most 2000 characters"),
  })
  .superRefine((data, ctx) => {
    if (leoProfanity.check(data.body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Reply contains inappropriate language",
      });
    }
  });

const voteSchema = z.object({
  targetType: z.enum(["Question", "Answer", "Reply"], "Target type is either 'Question', 'Answer' or 'Reply'"),
  targetId: z.string().min(1, "targetId is required"),
  voteType: z.enum(["upvote", "downvote"], "Vote type must be either 'upvote' or 'downvote'"),
});

export {
  createQuestionSchema,
  createAnswerOnQuestionSchema,
  createReplyOnAnswerSchema,
  voteSchema,
};
