import express from "express";

import {
  login,
  register,
  registerOrLogin,
} from "../controllers/authController.js";

import validate from "../middlewares/validateMiddleware.js";
import {
  loginSchema,
  oauthSchema,
  registerSchema,
} from "../validations/auth.schema.js";

const router = express.Router();

router.route("/register").post(validate(registerSchema), register);
router.route("/login").post(validate(loginSchema), login);
router.route("/registerOrLogin").post(validate(oauthSchema), registerOrLogin);

export default router;
