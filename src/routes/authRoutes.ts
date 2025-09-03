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

const router = express.Router();

router.route("/register").post(validate(registerSchema), register);
router.route("/login").post(validate(loginSchema), login);
router.route("/registerOrLogin").post(validate(oauthSchema), registerOrLogin);

router
  .route("/verifyEmail")
  .post(isAuthenticated, validate(verifyEmailSchema), verifyEmail);
router.route("/resendVerifyEmail").post(isAuthenticated, resendVerifyEmail);

router
  .route("/sendResetPasswordEmail")
  .post(isAuthenticated, sendResetPasswordEmail);
router
  .route("/resendResetPasswordEmail")
  .post(isAuthenticated, resendResetPasswordEmail);
router
  .route("/verifyResetPasswordOtp")
  .post(isAuthenticated, validate(verifyEmailSchema), verifyResetPasswordOtp);
router
  .route("/resetPassword")
  .post(isAuthenticated, validate(resetPasswordSchema), resetPassword);

router.route("/isAuth").get(isAuthenticated, isAuth);

router.route("/logout").post(isAuthenticated, logout);

export default router;
