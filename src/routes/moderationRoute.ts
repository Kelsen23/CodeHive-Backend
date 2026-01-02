import express from "express";

import {
  createReport,
  getBan,
  getReports,
  moderateReport,
} from "../controllers/moderationController.js";

import {
  moderateReportSchema,
  reportSchema,
} from "../validations/moderation.schema.js";

import { createReportLimiterMiddleware } from "../middlewares/rateLimiters/moderationRateLimiters.js";

import isAuthenticated, {
  requireActiveUser,
  isVerified,
  isAdmin,
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

router
  .route("/get/reports")
  .get(isAuthenticated, isVerified, requireActiveUser, isAdmin, getReports);

router.route("/get/ban").get(isAuthenticated, getBan);

router
  .route("/report/moderate")
  .post(
    isAuthenticated,
    isVerified,
    requireActiveUser,
    isAdmin,
    validate(moderateReportSchema),
    moderateReport,
  );

export default router;
