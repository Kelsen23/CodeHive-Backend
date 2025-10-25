import express from "express";

import {
  createQuestion,
  createAnswerOnQuestion,
  createReplyOnAnswer,
  vote,
  unvote,
  markAnswerAsBest,
} from "../controllers/questionController.js";

import {
  createQuestionSchema,
  createAnswerOnQuestionSchema,
  createReplyOnAnswerSchema,
  voteSchema,
  unvoteSchema,
} from "../validations/question.schema.js";

import {
  createQuestionLimiterMiddleware,
  createAnswerOnQuestionLimiterMiddleware,
  createReplyOnAnswerLimiterMiddleware,
  voteLimiterMiddleware,
  markAnswerAsBestLimiterMiddleware,
} from "../middlewares/rateLimiters/questionRateLimiters.js";

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

router
  .route("/create/reply/:answerId")
  .post(
    createReplyOnAnswerLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(createReplyOnAnswerSchema),
    createReplyOnAnswer,
  );

router
  .route("/vote")
  .post(
    voteLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(voteSchema),
    vote,
  );

router
  .route("/unvote")
  .delete(
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(unvoteSchema),
    unvote,
  );

router.route("/answer/markAsBest/:answerId").post(
  markAnswerAsBestLimiterMiddleware,
  isAuthenticated,
  isVerified,
  isTerminated,
  markAnswerAsBest,
)

export default router;
