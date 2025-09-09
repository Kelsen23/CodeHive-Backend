import express from "express";

import { updateProfile } from "../controllers/userController.js";

import isAuthenticated, {
  isTerminated,
  isVerified,
} from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";

import { updateProfileSchema } from "../validations/user.schema.js";

import { updateProfileLimiterMiddleware } from "../middlewares/rateLimiters/userRateLimiters.js";

const router = express.Router();

router
  .route("/updateProfile")
  .post(
    updateProfileLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(updateProfileSchema),
    updateProfile,
  );

export default router;
