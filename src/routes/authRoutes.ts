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
  emailVerificationLimiter,
  loginLimiter,
  registerLimiter,
  resendEmailLimiter,
  resetPasswordLimiter,
  generalLimiter,
} from "../middlewares/authRateLimiters.js";

const router = express.Router();

router
  .route("/register")
  .post(registerLimiter, validate(registerSchema), register);
router.route("/login").post(loginLimiter, validate(loginSchema), login);
router
  .route("/registerOrLogin")
  .post(registerLimiter, validate(oauthSchema), registerOrLogin);

router
  .route("/verifyEmail")
  .post(
    emailVerificationLimiter,
    isAuthenticated,
    validate(verifyEmailSchema),
    verifyEmail,
  );
router
  .route("/resendVerifyEmail")
  .post(resendEmailLimiter, isAuthenticated, resendVerifyEmail);

router
  .route("/sendResetPasswordEmail")
  .post(resetPasswordLimiter, isAuthenticated, sendResetPasswordEmail);
router
  .route("/resendResetPasswordEmail")
  .post(resendEmailLimiter, isAuthenticated, resendResetPasswordEmail);
router
  .route("/verifyResetPasswordOtp")
  .post(
    emailVerificationLimiter,
    isAuthenticated,
    validate(verifyEmailSchema),
    verifyResetPasswordOtp,
  );
router
  .route("/resetPassword")
  .post(
    resetPasswordLimiter,
    isAuthenticated,
    validate(resetPasswordSchema),
    resetPassword,
  );

router.route("/isAuth").get(generalLimiter, isAuthenticated, isAuth);

router.route("/logout").post(generalLimiter, isAuthenticated, logout);

export default router;
