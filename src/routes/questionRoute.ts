import express from "express";

import {
  createQuestion,
  createAnswerOnQuestion,
  createReplyOnAnswer,
  vote,
  unvote,
  markAnswerAsBest,
  unmarkAnswerAsBest,
  deleteContent,
} from "../controllers/questionController.js";

import {
  createQuestionSchema,
  createAnswerOnQuestionSchema,
  createReplyOnAnswerSchema,
  voteSchema,
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
  .route("/unvote/:targetType/:targetId")
  .delete(isAuthenticated, isVerified, isTerminated, unvote);

router
  .route("/answer/markAsBest/:answerId")
  .patch(
    markAnswerAsBestLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    markAnswerAsBest,
  );

router
  .route("/answer/unmarkAsBest/:answerId")
  .patch(isAuthenticated, isVerified, isTerminated, unmarkAnswerAsBest);

router
  .route("/:targetType/:targetId")
  .delete(isAuthenticated, isVerified, isTerminated, deleteContent);

export default router;
