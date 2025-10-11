import express from "express";

import { createQuestion } from "../controllers/questionController.js";

import { createQuestionSchema } from "../validations/question.schema.js";

import isAuthenticated, {
  isTerminated,
  isVerified,
} from "../middlewares/authMiddleware.js";

import { createQuestionLimiterMiddleware } from "../middlewares/rateLimiters/questionRateLimitiers.js";

import validate from "../middlewares/validateMiddleware.js";

const router = express.Router();

router
  .route("/create")
  .post(
    createQuestionLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(createQuestionSchema),
    createQuestion,
  );

export default router;
