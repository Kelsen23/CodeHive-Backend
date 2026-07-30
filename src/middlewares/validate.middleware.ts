import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

type ValidationTarget = "body" | "params";

type ValidateMiddleware = {
  (schema: ZodSchema): ReturnType<typeof createValidator>;
  (
    target: ValidationTarget,
    schema: ZodSchema,
  ): ReturnType<typeof createValidator>;
};

const validate: ValidateMiddleware = (
  targetOrSchema: ValidationTarget | ZodSchema,
  schema?: ZodSchema,
) => {
  const target = typeof targetOrSchema === "string" ? targetOrSchema : "body";
  const validationSchema =
    typeof targetOrSchema === "string" ? schema : targetOrSchema;

  if (!validationSchema) {
    throw new Error("Validation schema is required");
  }

  return createValidator(target, validationSchema);
};

const createValidator =
  (target: ValidationTarget, schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestKey = target === "params" ? "params" : "body";
      const parsed = schema.parse(req[requestKey]);

      if (target === "params") {
        (req as Request & { params: any }).params = parsed;
      } else {
        req.body = parsed;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ message: "Validation Failed", errors: error.issues });
    }
  };

export default validate;
export type { ValidationTarget };
