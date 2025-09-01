import express from "express";

import { login, register } from "../controllers/authController.js";

import validate from "../middlewares/validateMiddleware.js";
import { loginSchema, registerSchema } from "../validations/auth.schema.js";

const router = express.Router();

router.route("/register").post(validate(registerSchema), register);
router.route("/login").post(validate(loginSchema), login);  

export default router;
