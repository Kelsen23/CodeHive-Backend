import { Request, Response } from "express";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import asyncHandler from "../middlewares/asyncHandler.js";

import HttpError from "../utils/httpError.js";

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

export { createReport };
