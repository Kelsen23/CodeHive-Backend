import express from "express";

import {
  login,
  register,
  registerOrLogin,
  resendVerifyEmail,
  verifyEmail,
} from "../controllers/authController.js";

import isAuthenticated from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import {
  loginSchema,
  oauthSchema,
  registerSchema,
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

export default router;
