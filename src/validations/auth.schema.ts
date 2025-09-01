import z from "zod";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be atleast 3 characters")
    .max(15, "Username must be at most 15 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .min(5, "Email must be at least 5 characters")
    .max(345, "Email must be at most 345 characters"),
  password: z
    .string()
    .min(8, "Password must be atleast 8 characters")
    .max(60, "Password must be at most 60 characters"),
});

const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .min(5, "Email must be at least 5 characters")
    .max(345, "Email must be at most 345 characters"),
  password: z
    .string()
    .min(8, "Password must be atleast 8 characters")
    .max(60, "Password must be at most 60 characters"),
});

const googleSchema = z.object({
  provider: z.literal("google"),
  email: z
    .string()
    .email("Invalid email address")
    .min(5, "Email must be at least 5 characters")
    .max(345, "Email must be at most 345 characters"),
  name: z
    .string()
    .min(3, "Username must be atleast 3 characters")
    .max(15, "Username must be at most 15 characters"),
  picture: z.string().url("Invalid picture url"),
  email_verified: z.boolean(),
});

const githubSchema = z.object({
  provider: z.literal("github"),
  email: z
    .string()
    .email("Invalid email address")
    .min(5, "Email must be at least 5 characters")
    .max(345, "Email must be at most 345 characters"),
  name: z
    .string()
    .min(3, "Username must be atleast 3 characters")
    .max(15, "Username must be at most 15 characters"),
  avatar_url: z.string().url("Invalid picture url"),
});

export { registerSchema, loginSchema };
export const oauthSchema = z.discriminatedUnion("provider", [
  googleSchema,
  githubSchema,
]);
