import { createRequire } from "module";
import z from "zod";

const require = createRequire(import.meta.url);

const leoProfanity = require("leo-profanity");

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export { leoProfanity, objectIdSchema };
