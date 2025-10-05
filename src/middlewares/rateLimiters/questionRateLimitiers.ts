import { RateLimiterRedis } from "rate-limiter-flexible";
import { redisClient } from "../../config/redis.js";

import createRateLimiterMiddleware from "../createRateLimiterMiddleware.js";

const createQuestionLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "createQuestion",
  points: 8,
  duration: 60 * 30,
});

const createQuestionLimiterMiddleware = createRateLimiterMiddleware(
  createQuestionLimiter,
  "Too many questions created, try again after half an hour",
);

export { createQuestionLimiterMiddleware };
