import { RateLimiterRedis } from "rate-limiter-flexible";
import { redisClient } from "../../config/redis.js";

import createRateLimiterMiddleware from "../createRateLimiterMiddleware.js";
import { markAnswerAsBest } from "../../controllers/questionController.js";

const createQuestionLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "createQuestion",
  points: 8,
  duration: 60 * 30,
});

const createAnswerOnQuestionLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "createAnswerOnQuestion",
  points: 3,
  duration: 60 * 30,
});

const createReplyOnAnswerLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "createReplyOnAnswer",
  points: 5,
  duration: 60 * 15,
});

const voteLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "vote",
  points: 20,
  duration: 60 * 15,
});

const markAnswerAsBestLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "markAnswerAsBest",
  points: 5,
  duration: 60 * 30,
});

const createQuestionLimiterMiddleware = createRateLimiterMiddleware(
  createQuestionLimiter,
  "Too many questions created, try again after half an hour",
);

const createAnswerOnQuestionLimiterMiddleware = createRateLimiterMiddleware(
  createAnswerOnQuestionLimiter,
  "Too many answers created, try again after half an hour",
);

const createReplyOnAnswerLimiterMiddleware = createRateLimiterMiddleware(
  createReplyOnAnswerLimiter,
  "Too many replies created, try again after half 15 minutes",
);

const voteLimiterMiddleware = createRateLimiterMiddleware(
  voteLimiter,
  "Too many votes, try again after 15 minutes",
);

const markAnswerAsBestLimiterMiddleware = createRateLimiterMiddleware(
  markAnswerAsBestLimiter,
  "Too many answers marked, try again after half an hour",
);

export {
  createQuestionLimiterMiddleware,
  createAnswerOnQuestionLimiterMiddleware,
  createReplyOnAnswerLimiterMiddleware,
  voteLimiterMiddleware,
  markAnswerAsBestLimiterMiddleware,
};
