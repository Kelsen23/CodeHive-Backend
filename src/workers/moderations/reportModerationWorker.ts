import { Worker } from "bullmq";

import {
  redisMessagingClientConnection,
  redisCacheClient,
} from "../../config/redis.js";

import aiModerateReport from "../../services/aiModerationService.js";

import calculateTempBanMs from "../../utils/calculateTempBanMs.js";

import Question from "../../models/questionModel.js";
import Answer from "../../models/answerModel.js";
import Reply from "../../models/replyModel.js";
import Report from "../../models/reportModel.js";

import prisma from "../../config/prisma.js";

import { redisPub } from "../../redis/pubsub.js";

const mapSeverityToDecision = (severity: number) => {
  if (severity >= 90) return "BAN_USER_PERM";
  if (severity >= 70) return "BAN_USER_TEMP";
  if (severity >= 50) return "WARN_USER";
  if (severity !== 0) return "UNCERTAIN";
  return "IGNORE";
};

const publishSocketEvent = (userId: string, event: string, data: any) => {
  redisPub.publish("socket:emit", JSON.stringify({ userId, event, data }));
};

new Worker(
  "reportModerationQueue",
  async (job) => {
    try {
      const { report } = job.data;
      let content = "";

      if (report.targetType === "Question") {
        const cachedQuestion = await redisCacheClient.get(
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
        const newBan = await prisma.ban.create({
          data: {
            userId: report.targetUserId as string,
            title: "Permanent Account Suspension",
            reasons: aiReasons,
            banType: "PERM",
            severity: "FIVE",
            bannedBy: "AI_MODERATION",
          },
        });

        await prisma.user.update({
          where: { id: report.targetUserId as string },
          data: { status: "TERMINATED" },
        });

        redisPub.publish(
          "socket:emit",
          JSON.stringify({
            userId: report.targetUserId as string,
            event: "banUser",
            data: newBan,
          }),
        );

        redisPub.publish(
          "socket:disconnect",
          JSON.stringify(report.targetUserId as string),
        );

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

        publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          status: "RESOLVED",
        });
      }

      if (aiDecision === "BAN_USER_TEMP") {
        const tempBanMs = calculateTempBanMs(severity, aiConfidence);

        const newBan = await prisma.ban.create({
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

        await prisma.user.update({
          where: { id: report.targetUserId as string },
          data: { status: "TERMINATED" },
        });

        publishSocketEvent(report.targetUserId as string, "banUser", newBan);

        redisPub.publish(
          "socket:disconnect",
          JSON.stringify(report.targetUserId as string),
        );

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

        publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          status: "RESOLVED",
        });
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

        publishSocketEvent(
          report.targetUserId as string,
          "warnUser",
          newWarning,
        );

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

        publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          status: "RESOLVED",
        });
      }

      if (aiDecision === "UNCERTAIN") {
        await Report.findOneAndUpdate(report._id, {
          aiDecisions: [aiDecision],
          aiConfidence,
          aiReasons,
          status: "REVIEWING",
        });

        publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
          actionsTaken:
            severity >= 60 ? [aiDecision, "REMOVE_CONTENT"] : [aiDecision],
          status: "REVIEWING",
        });
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

        publishSocketEvent(report.reportedBy as string, "reportStatusChanged", {
          actionsTaken: [aiDecision],
          status: "DISMISSED",
        });
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
  { connection: redisMessagingClientConnection, concurrency: 20 },
);
