import express from "express";

import {
  isAuth,
  login,
  logout,
  register,
  registerOrLogin,
  resendResetPasswordEmail,
  resendVerifyEmail,
  resetPassword,
  sendResetPasswordEmail,
  verifyEmail,
  verifyResetPasswordOtp,
} from "../controllers/authController.js";

import isAuthenticated from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import {
  loginSchema,
  oauthSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validations/auth.schema.js";

import {
  emailVerificationLimiterMiddleware,
  loginLimiterMiddleware,
  registerLimiterMiddleware,
  resendEmailLimiterMiddleware,
  resetPasswordLimiterMiddleware,
  generalLimiterMiddleware,
} from "../middlewares/rateLimiters/authRateLimiters.js";

const router = express.Router();

router
  .route("/register")
  .post(registerLimiterMiddleware, validate(registerSchema), register);
router
  .route("/login")
  .post(loginLimiterMiddleware, validate(loginSchema), login);
router
  .route("/registerOrLogin")
  .post(registerLimiterMiddleware, validate(oauthSchema), registerOrLogin);

router
  .route("/verifyEmail")
  .post(
    emailVerificationLimiterMiddleware,
    isAuthenticated,
    validate(verifyEmailSchema),
    verifyEmail,
  );
router
  .route("/resendVerifyEmail")
  .post(resendEmailLimiterMiddleware, isAuthenticated, resendVerifyEmail);

router
  .route("/sendResetPasswordEmail")
  .post(
    resetPasswordLimiterMiddleware,
    isAuthenticated,
    sendResetPasswordEmail,
  );
router
  .route("/resendResetPasswordEmail")
  .post(
    resendEmailLimiterMiddleware,
    isAuthenticated,
    resendResetPasswordEmail,
  );
router
  .route("/verifyResetPasswordOtp")
  .post(
    emailVerificationLimiterMiddleware,
    isAuthenticated,
    validate(verifyEmailSchema),
    verifyResetPasswordOtp,
  );
router
  .route("/resetPassword")
  .post(
    resetPasswordLimiterMiddleware,
    isAuthenticated,
    validate(resetPasswordSchema),
    resetPassword,
  );

router.route("/isAuth").get(generalLimiterMiddleware, isAuthenticated, isAuth);

router.route("/logout").post(generalLimiterMiddleware, isAuthenticated, logout);

export default router;
