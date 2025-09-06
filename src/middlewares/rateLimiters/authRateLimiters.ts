import { RateLimiterRedis } from "rate-limiter-flexible";
import { redisClient } from "../../config/redis.js";

import createRateLimiterMiddleware from "../../utils/createRateLimiterMiddleware.js";

const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "login",
  points: 5,
  duration: 15 * 60,
});

const registerLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "register",
  points: 5,
  duration: 30 * 60,
});

const resetPasswordLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "resetPassword",
  points: 5,
  duration: 60 * 60,
});

const emailVerificationLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "emailVerification",
  points: 10,
  duration: 60 * 60,
});

const resendEmailLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "resendEmail",
  points: 3,
  duration: 5 * 60,
});

const generalLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "general",
  points: 1000,
  duration: 10 * 60,
});

const loginLimiterMiddleware = createRateLimiterMiddleware(
  loginLimiter,
  "Too many login attempts from this IP, please try again after 15 minutes",
);

const registerLimiterMiddleware = createRateLimiterMiddleware(
  registerLimiter,
  "Too many accounts created from this IP, please try again after 30 minutes",
);

const resetPasswordLimiterMiddleware = createRateLimiterMiddleware(
  resetPasswordLimiter,
  "Too many password reset requests from this IP, please try again after an hour",
);

const emailVerificationLimiterMiddleware = createRateLimiterMiddleware(
  emailVerificationLimiter,
  "Too many email verification requests, please try again later",
);

const resendEmailLimiterMiddleware = createRateLimiterMiddleware(
  resendEmailLimiter,
  "Too many email resend requests, please wait before requesting again",
);

const generalLimiterMiddleware = createRateLimiterMiddleware(
  generalLimiter,
  "Too many requests please wait before requesting again",
);

export {
  loginLimiterMiddleware,
  registerLimiterMiddleware,
  resetPasswordLimiterMiddleware,
  emailVerificationLimiterMiddleware,
  resendEmailLimiterMiddleware,
  generalLimiterMiddleware,
};
