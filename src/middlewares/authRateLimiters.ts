import { rateLimit } from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message:
    "Too many accounts created from this IP, please try again after an hour",
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message:
    "Too many password reset requests from this IP, please try again after an hour",
  standardHeaders: true,
  legacyHeaders: false,
});

const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many email verification requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

const resendEmailLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 2,
  message:
    "Too many email resend requests, please wait before requesting again",
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  message: "Too many requests please wait before requesting again",
  standardHeaders: true,
  legacyHeaders: false,
});

export {
  loginLimiter,
  registerLimiter,
  resetPasswordLimiter,
  emailVerificationLimiter,
  resendEmailLimiter,
  generalLimiter,
};
