import { Request, Response } from "express";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import asyncHandler from "../middlewares/asyncHandler.js";

import HttpError from "../utils/httpError.js";
import addAdminModPoints from "../utils/addAdminModPoints.js";

import Question from "../models/questionModel.js";
import Answer from "../models/answerModel.js";
import Reply from "../models/replyModel.js";

import Report from "../models/reportModel.js";

import prisma from "../config/prisma.js";

import reportModerationQueue from "../queues/moderations/reportModerationQueue.js";

import { redisPub } from "../redis/pubsub.js";

import publishSocketEvent from "../utils/publishSocketEvent.js";

const createReport = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: reportedBy } = req.user;
    const { targetId, targetUserId, targetType, reportReason, reportComment } =
      req.body;

    let foundContent;

    switch (targetType) {
      case "Question":
        foundContent = await Question.findOne(
          { _id: targetId, isActive: true },
          { userId: 1 },
        );
        break;

      case "Answer":
        foundContent = await Answer.findOne(
          { _id: targetId, isActive: true },
          { userId: 1 },
        );
        break;

      case "Reply":
        foundContent = await Reply.findOne(
          { _id: targetId, isActive: true },
          { userId: 1 },
        );
        break;
    }

    if (!foundContent) {
      throw new HttpError("Target content not found", 404);
    }

    if ((foundContent.userId as string).toString() !== targetUserId) {
      throw new HttpError("targetUserId does not match content owner", 400);
    }

    const newReport = await Report.create({
      reportedBy,
      targetId,
      targetUserId,
      targetType,
      reportReason,
      reportComment,
    });

    reportModerationQueue.add(
      "reportContent",
      { report: newReport },
      { removeOnComplete: true, removeOnFail: false },
    );

    res
      .status(201)
      .json({ message: "Report successfully created", report: newReport });
  },
);

const getReports = asyncHandler(async (req: Request, res: Response) => {
  const reportsForModeration = await Report.find({
    aiDecision: { $eq: "UNCERTAIN" },
    status: "REVIEWING",
  });

  res.status(200).json({
    message: "Successfully received reports for moderation",
    reports: reportsForModeration,
  });
});

const moderateReport = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const {
      reportId,
      title,
      actionTaken,
      adminReasons,
      severity,
      banDurationMs,
    } = req.body;

    await addAdminModPoints(userId, actionTaken);

    const report = await Report.findById(reportId);

    if (!report) throw new HttpError("Report not found", 404);

    if (report.status !== "REVIEWING" || report.aiDecision !== "UNCERTAIN")
      throw new HttpError("Report not available for manual moderation", 403);

    if (actionTaken === "BAN_USER_PERM") {
      const newBan = await prisma.ban.create({
        data: {
          userId: report.targetUserId,
          title,
          reasons: adminReasons,
          banType: "PERM",
          severity,
          bannedBy: "ADMIN_MODERATION",
        },
      });

      await prisma.user.update({
        where: { id: report.targetUserId },
        data: { status: "TERMINATED" },
      });

      await publishSocketEvent(report.targetUserId as string, "banUser", newBan);

      redisPub.publish(
        "socket:disconnect",
        JSON.stringify(report.targetUserId as string),
      );

      const updatedReport = await Report.findByIdAndUpdate(
        report._id,
        {
          actionTaken,
          status: "RESOLVED",
          adminReasons,
          severity,
          isRemovingContent: true,
        },
        { new: true },
      );

      publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
        actionTaken: updatedReport?.actionTaken,
        status: updatedReport?.status,
        isRemovingContent: updatedReport?.isRemovingContent,
      });
    } else if (actionTaken === "BAN_USER_TEMP") {
      if (!banDurationMs)
        throw new HttpError(
          "banDurationMs is required for temporary bans",
          400,
        );

      const newBan = await prisma.ban.create({
        data: {
          userId: report.targetUserId,
          title,
          reasons: adminReasons,
          banType: "TEMP",
          severity,
          bannedBy: "ADMIN_MODERATION",
          expiresAt: new Date(Date.now() + banDurationMs),
          durationMs: banDurationMs,
        },
      });

      await prisma.user.update({
        where: { id: report.targetUserId },
        data: { status: "SUSPENDED" },
      });

      await publishSocketEvent(report.targetUserId as string, "banUser", newBan);

      redisPub.publish(
        "socket:disconnect",
        JSON.stringify(report.targetUserId as string),
      );

      const updatedReport = await Report.findByIdAndUpdate(
        report._id,
        {
          actionTaken,
          status: "RESOLVED",
          adminReasons,
          severity,
          isRemovingContent: true,
        },
        { new: true },
      );

      publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
        actionTaken: updatedReport?.actionTaken,
        status: updatedReport?.status,
        isRemovingContent: updatedReport?.isRemovingContent,
      });
    } else if (actionTaken === "WARN_USER") {
      const newWarning = await prisma.warning.create({
        data: {
          userId: report.targetUserId,
          title,
          reasons: adminReasons,
          severity,
          warnedBy: "ADMIN_MODERATION",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      publishSocketEvent(report.targetUserId as string, "warnUser", newWarning);

      const updatedReport = await Report.findByIdAndUpdate(
        report._id,
        {
          actionTaken,
          status: "RESOLVED",
          isRemovingContent: false,
          adminReasons,
        },
        { new: true },
      );

      publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
        actionTaken: updatedReport?.actionTaken,
        status: updatedReport?.status,
        isRemovingContent: updatedReport?.isRemovingContent,
      });
    } else if (actionTaken === "IGNORE") {
      const updatedReport = await Report.findByIdAndUpdate(
        report._id,
        {
          actionTaken,
          status: "DISMISSED",
          adminReasons,
          severity,
          isRemovingContent: false,
        },
        { new: true },
      );

      publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
        actionTaken: updatedReport?.actionTaken,
        status: updatedReport?.status,
        isRemovingContent: updatedReport?.isRemovingContent,
      });
    }

    if (actionTaken === "BAN_USER_TEMP" || actionTaken === "BAN_USER_PERM") {
      switch (report.targetType) {
        case "Question":
          await Question.updateOne(
            { _id: report.targetId, isActive: true },
            { isActive: false },
          );
          break;
        case "Answer":
          await Answer.updateOne(
            { _id: report.targetId, isActive: true },
            { isActive: false },
          );
          break;
        case "Reply":
          await Reply.updateOne(
            { _id: report.targetId, isActive: true },
            { isActive: false },
          );
          break;
      }
    } else {
      throw new HttpError("Invalid actionTaken value", 400);
    }

    res.status(200).json({ message: "Report successfully reviewed" });
  },
);

export { createReport, getReports, moderateReport };
