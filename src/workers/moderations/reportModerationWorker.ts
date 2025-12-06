import { Worker } from "bullmq";
import { redisConnection, redisClient } from "../../config/redis.js";

import aiModerateReport from "../../services/aiModerationService.js";

import calculateTempBanMs from "../../utils/calculateTempBanMs.js";

import Question from "../../models/questionModel.js";
import Answer from "../../models/answerModel.js";
import Reply from "../../models/replyModel.js";
import Report from "../../models/reportModel.js";

import prisma from "../../config/prisma.js";

import { io, onlineUsers } from "../../index.js";

const mapSeverityToDecision = (severity: number) => {
  if (severity >= 90) return "BAN_USER_PERM";
  if (severity >= 70) return "BAN_USER_TEMP";
  if (severity >= 50) return "WARN_USER";
  if (severity !== 0) return "UNCERTAIN";
  return "IGNORE";
};

new Worker(
  "reportModerationQueue",
  async (job) => {
    try {
      const { report } = job.data;
      let content = "";

      if (report.targetType === "Question") {
        const cachedQuestion = await redisClient.get(
          `question:${report.targetId}`,
        );
        const question = cachedQuestion
          ? JSON.parse(cachedQuestion)
          : await Question.findById(report.targetId).select("title body");

        content = `Title: ${question?.title || ""}\nBody: ${question?.body || ""}`;
      } else if (report.targetType === "Answer") {
        const answer = await Answer.findById(report.targetId).select("body");

        content = `Body: ${answer?.body || ""}`;
      } else if (report.targetType === "Reply") {
        const reply = await Reply.findById(report.targetId).select("body");

        content = `Body: ${reply?.body || ""}`;
      }

      const {
        confidence: aiConfidence,
        reasons: aiReasons,
        severity,
      } = await aiModerateReport(content);

      const aiDecision = mapSeverityToDecision(severity);

      if (aiDecision === "BAN_USER_PERM") {
        await prisma.ban.create({
          data: {
            userId: report.targetUserId as string,
            title: "Permanent Account Suspension",
            reasons: aiReasons,
            banType: "PERM",
            severity: "FIVE",
            bannedBy: "AI_MODERATION",
          },
        });

        const targetUserSocketId = onlineUsers.get(report.targetUserId);

        if (targetUserSocketId) {
          io.to(targetUserSocketId).emit("banUser", {
            userId: report.targetUserId as string,
            title: "Permanent Account Suspension",
            reasons: aiReasons,
            banType: "PERM",
            severity: "FIVE",
            bannedBy: "AI_MODERATION",
          });
        }

        await Report.findOneAndUpdate(report._id, {
          severity,
          aiDecisions:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          aiConfidence,
          aiReasons,
          status: "RESOLVED",
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
        });

        const reportedBySocketId = onlineUsers.get(report.reportedBy);

        if (reportedBySocketId) {
          io.to(reportedBySocketId).emit("reportStatusChanged", {
            actionsTaken:
              severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
            status: "RESOLVED",
          });
        }
      }

      if (aiDecision === "BAN_USER_TEMP") {
        const tempBanMs = calculateTempBanMs(severity, aiConfidence);

        await prisma.ban.create({
          data: {
            userId: report.targetUserId as string,
            title: "Temporary Account Suspension",
            reasons: aiReasons,
            banType: "TEMP",
            severity: "FOUR",
            bannedBy: "AI_MODERATION",
            expiresAt: new Date(Date.now() + tempBanMs),
            durationMs: tempBanMs,
          },
        });

        const targetUserSocketId = onlineUsers.get(report.targetUserId);

        if (targetUserSocketId) {
          io.to(targetUserSocketId).emit("banUser", {
            userId: report.targetUserId as string,
            title: "Temporary Account Suspension",
            reasons: aiReasons,
            banType: "TEMP",
            severity: "FOUR",
            bannedBy: "AI_MODERATION",
          });
        }

        await Report.findOneAndUpdate(report._id, {
          severity,
          aiDecisions:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          aiConfidence,
          aiReasons,
          status: "RESOLVED",
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
        });

        const reportedBySocketId = onlineUsers.get(report.reportedBy);

        if (reportedBySocketId) {
          io.to(reportedBySocketId).emit("reportStatusChanged", {
            actionsTaken:
              severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
            status: "RESOLVED",
          });
        }
      }

      if (aiDecision === "WARN_USER") {
        const title =
          aiReasons.length > 0
            ? `${aiReasons[0]}`
            : "Community Guideline Warning";

        const newWarning = await prisma.warning.create({
          data: {
            userId: report.targetUserId as string,
            title,
            reasons: aiReasons,
            severity: "THREE",
            warnedBy: "AI_MODERATION",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        const targetUserSocketId = onlineUsers.get(report.targetUserId);

        if (targetUserSocketId) {
          io.to(targetUserSocketId).emit("warnUser", {
            userId: report.targetUserId as string,
            title,
            reasons: aiReasons,
            severity: "THREE",
            warnedBy: "AI_MODERATION",
          });

          await prisma.warning.update({
            where: { id: newWarning.id },
            data: { delivered: true },
          });
        }

        await Report.findOneAndUpdate(report._id, {
          severity,
          aiDecisions:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          aiConfidence,
          aiReasons,
          status: "RESOLVED",
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
        });

        const reportedBySocketId = onlineUsers.get(report.reportedBy);

        if (reportedBySocketId) {
          io.to(reportedBySocketId).emit("reportStatusChanged", {
            actionsTaken:
              severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
            status: "RESOLVED",
          });
        }
      }

      if (aiDecision === "UNCERTAIN") {
        await Report.findOneAndUpdate(report._id, {
          aiDecisions: [aiDecision],
          aiConfidence,
          aiReasons,
          status: "REVIEWING",
        });

        const reportedBySocketId = onlineUsers.get(report.reportedBy);

        if (reportedBySocketId) {
          io.to(reportedBySocketId).emit("reportStatusChanged", {
            aiDecisions:
              severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
            status: "REVIEWING",
          });
        }
      }

      if (aiDecision === "IGNORE") {
        await Report.findOneAndUpdate(report._id, {
          severity,
          aiDecisions: [aiDecision],
          aiConfidence,
          aiReasons,
          status: "DISMISSED",
          actionsTaken: "NO_ACTION",
        });

        const reportedBySocketId = onlineUsers.get(report.reportedBy);

        if (reportedBySocketId) {
          io.to(reportedBySocketId).emit("reportStatusChanged", {
            aiDecisions: [aiDecision],
            status: "DISMISSED",
          });
        }
      }

      if (aiDecision)
        if (severity >= 60) {
          if (report.targetType === "Question")
            await Question.findByIdAndUpdate(report.targetId, {
              isActive: false,
            });
          if (report.targetType === "Answer")
            await Answer.findByIdAndUpdate(report.targetId, {
              isActive: false,
            });
          if (report.targetType === "Reply")
            await Reply.findByIdAndUpdate(report.targetId, { isActive: false });
        }
    } catch (error) {
      console.error("Error processing moderation report:", error);
    }
  },
  { connection: redisConnection, concurrency: 20 },
);
