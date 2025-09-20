import express from "express";

import {
  getInterests,
  saveInterests,
  updateProfile,
} from "../controllers/userController.js";

import isAuthenticated, {
  isTerminated,
  isVerified,
} from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";

import { updateProfileSchema } from "../validations/user.schema.js";

import { updateProfileLimiterMiddleware } from "../middlewares/rateLimiters/userRateLimiters.js";
import { getInterestsLimiterMiddleware } from "../middlewares/rateLimiters/userRateLimiters.js";
import { saveInterestsLimiterMiddleware } from "../middlewares/rateLimiters/userRateLimiters.js";

const router = express.Router();

router
  .route("/updateProfile")
  .put(
    updateProfileLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    validate(updateProfileSchema),
    updateProfile,
  );

router
  .route("/getInterests")
  .get(
    getInterestsLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    getInterests,
  );
router
  .route("/saveInterests")
  .put(
    saveInterestsLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    saveInterests,
  );

export default router;
