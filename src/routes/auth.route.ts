import express from "express";

import {
  changePassword,
  isAuth,
  login,
  logout,
  register,
  registerOrLogin,
  resendResetPasswordEmail,
  resendVerificationEmail,
  resetPassword,
  sendResetPasswordEmail,
  verifyEmail,
  verifyResetPasswordOtp,
} from "../controllers/auth.controller.js";

import isAuthenticated, {
  requireLoggedOut,
} from "../middlewares/auth.middleware.js";

import {
  emailVerificationLimiterMiddleware,
  loginLimiterMiddleware,
  oauthLimiterMiddleware,
  registerLimiterMiddleware,
  passwordResetLimiterMiddleware,
  resendEmailLimiterMiddleware,
  sessionLimiterMiddleware,
  userEmailVerificationLimiterMiddleware,
  userPasswordChangeLimiterMiddleware,
  userResendEmailLimiterMiddleware,
} from "../middlewares/rate-limiters/auth.rate-limiters.js";

import validate from "../middlewares/validate.middleware.js";

import {
  changePasswordSchema,
  loginSchema,
  oauthSchema,
  registerSchema,
  resetPasswordSchema,
  sendResetPasswordEmailSchema,
  verifyEmailSchema,
  verifyResetPasswordOtpSchema,
} from "../validations/auth.schema.js";

const router = express.Router();

router
  .route("/register")
  .post(registerLimiterMiddleware, validate("body", registerSchema), register);

router
  .route("/login")
  .post(loginLimiterMiddleware, validate("body", loginSchema), login);

router
  .route("/oauth")
  .post(oauthLimiterMiddleware, validate("body", oauthSchema), registerOrLogin);

router
  .route("/email/verify")
  .post(
    isAuthenticated,
    userEmailVerificationLimiterMiddleware,
    validate("body", verifyEmailSchema),
    verifyEmail,
  );

router
  .route("/email/resend")
  .post(
    isAuthenticated,
    userResendEmailLimiterMiddleware,
    resendVerificationEmail,
  );

router
  .route("/password/reset/send")
  .post(
    requireLoggedOut,
    passwordResetLimiterMiddleware,
    validate("body", sendResetPasswordEmailSchema),
    sendResetPasswordEmail,
  );

router
  .route("/password/reset/resend")
  .post(
    requireLoggedOut,
    resendEmailLimiterMiddleware,
    validate("body", sendResetPasswordEmailSchema),
    resendResetPasswordEmail,
  );

router
  .route("/password/reset/verify")
  .post(
    requireLoggedOut,
    emailVerificationLimiterMiddleware,
    validate("body", verifyResetPasswordOtpSchema),
    verifyResetPasswordOtp,
  );

router
  .route("/password/reset")
  .post(
    requireLoggedOut,
    passwordResetLimiterMiddleware,
    validate("body", resetPasswordSchema),
    resetPassword,
  );

router
  .route("/password/change")
  .post(
    isAuthenticated,
    userPasswordChangeLimiterMiddleware,
    validate("body", changePasswordSchema),
    changePassword,
  );

router.route("/session").get(sessionLimiterMiddleware, isAuthenticated, isAuth);

router
  .route("/session")
  .post(sessionLimiterMiddleware, isAuthenticated, logout);

export default router;
