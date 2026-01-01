import z from "zod";

const reportSchema = z.object({
  targetId: z.string(),
  targetUserId: z.string().uuid("Invalid targetUserId"),
  targetType: z.enum(["Question", "Answer", "Reply"], "Invalid targetType"),
  reportReason: z.enum(
    [
      "SPAM",
      "HARASSMENT",
      "HATE_SPEECH",
      "INAPPROPRIATE_CONTENT",
      "MISINFORMATION",
      "OTHER",
    ],
    "Invalid reportReason",
  ),
  reportComment: z
    .string()
    .min(3, "Comment must be at least 3 characters")
    .max(150, "Comment must be at most 150 characters")
    .optional(),
});

export { reportSchema };
