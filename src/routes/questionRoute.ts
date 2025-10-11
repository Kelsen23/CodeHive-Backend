import express from "express";

import {
  createQuestion,
  createAnswerOnQuestion,
} from "../controllers/questionController.js";

import {
  createQuestionSchema,
  createAnswerOnQuestionSchema,
} from "../validations/question.schema.js";

import {
  createQuestionLimiterMiddleware,
  createAnswerOnQuestionLimiterMiddleware,
} from "../middlewares/rateLimiters/questionRateLimitiers.js";

import isAuthenticated, {
  isTerminated,
  isVerified,
} from "../middlewares/authMiddleware.js";

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

router
  .route("/create/answer/:questionId")
  .post(
    createAnswerOnQuestionLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(createAnswerOnQuestionSchema),
    createAnswerOnQuestion,
  );

export default router;
