import { RateLimiterRedis } from "rate-limiter-flexible";
import { redisClient } from "../../config/redis.js";

import createRateLimiterMiddleware from "../../utils/createRateLimiterMiddleware.js";

const updateProfileLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "updateProfile",
  points: 3,
  duration: 15 * 60,
});

const updateProfileLimiterMiddleware = createRateLimiterMiddleware(
  updateProfileLimiter,
  "Too many update profile attempts from this IP, please try again after 15 minutes",
);

export { updateProfileLimiterMiddleware };
