import { RateLimiterRedis } from "rate-limiter-flexible";
import { redisClient } from "../../config/redis.js";

import createRateLimiterMiddleware from "../createRateLimiterMiddleware.js";

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

export {
  createQuestionLimiterMiddleware,
  createAnswerOnQuestionLimiterMiddleware,
  createReplyOnAnswerLimiterMiddleware,
};
