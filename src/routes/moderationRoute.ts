import express from "express";

import { createReport } from "../controllers/moderationController.js";

import { reportSchema } from "../validations/moderation.schema.js";

import { createReportLimiterMiddleware } from "../middlewares/rateLimiters/moderationRateLimiters.js";

import isAuthenticated, {
  requireActiveUser,
  isVerified,
} from "../middlewares/authMiddleware.js";

import validate from "../middlewares/validateMiddleware.js";

const router = express.Router();

router
  .route("/report/create")
  .post(
    isAuthenticated,
    isVerified,
    requireActiveUser,
    validate(reportSchema),
    createReport,
  );

export default router;
