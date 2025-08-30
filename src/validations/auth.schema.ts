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

export { registerSchema, loginSchema };
