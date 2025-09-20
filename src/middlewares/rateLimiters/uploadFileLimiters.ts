import { RateLimiterRedis } from "rate-limiter-flexible";
import { redisClient } from "../../config/redis.js";

import createRateLimiterMiddleware from "../createRateLimiterMiddleware.js";

const uploadProfilePictureLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "uploadProfilePicture",
  points: 3,
  duration: 60 * 60,
});

const uploadProfilePictureLimiterMiddleware = createRateLimiterMiddleware(
  uploadProfilePictureLimiter,
  "Too many profile picture changes, try again after an hour",
);

export { uploadProfilePictureLimiterMiddleware };
