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
        message: "Body contains inappropriate language",
      });
    }
  });

const createAnswerOnQuestionSchema = z
  .object({
    body: z
      .string()
      .min(10, "Body must be at least 10 characters")
      .max(5000, "Body must be at most 5000 characters"),
  })
  .superRefine((data, ctx) => {
    if (leoProfanity.check(data.body)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Body contains inappropriate language",
      });
    }
  });

export { createQuestionSchema, createAnswerOnQuestionSchema };
