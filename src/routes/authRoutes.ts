import express from "express";
import { register } from "../controllers/authController.js";
import validate from "../middlewares/validateMiddleware.js";
import { registerSchema } from "../validations/auth.schema.js";

const router = express.Router();

router.route("/register").post(validate(registerSchema), register);

export default router;
