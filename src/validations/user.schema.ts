import { createRequire } from "module";

import z from "zod";

const require = createRequire(import.meta.url);
const leoProfanity = require("leo-profanity");

const updateProfile = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(15, "Username must be at most 15 characters")
    .regex(
      /^[a-zA-Z0-9_. ]+$/,
      "Only letters, numbers, spaces, underscores, and dots allowed",
    )
    .refine((username) => username.trim().length > 0, {
      message: "Username cannot be only spaces",
    })
    .refine((username) => !leoProfanity.check(username), {
      message: "Username contains inappropriate language",
    }),
  bio: z
    .string()
    .max(150, "Bio must be at most 150 characters")
    .refine((bio) => (bio ? !leoProfanity.check(bio) : true), {
      message: "Bio contains inappropriate language",
    }),
});

export { updateProfile };
