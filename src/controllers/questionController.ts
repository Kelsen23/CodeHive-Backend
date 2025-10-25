import asyncHandler from "../middlewares/asyncHandler.js";

import { Request, Response } from "express";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import invalidateCacheOnUnvote from "../utils/invalidateCacheOnUnvote.js";
import HttpError from "../utils/httpError.js";

import Question from "../models/questionModel.js";
import Answer from "../models/answerModel.js";
import Reply from "../models/replyModel.js";
import Vote from "../models/voteModel.js";

import { prisma } from "../index.js";
import { redisClient } from "../config/redis.js";

const createQuestion = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { title, body, tags } = req.body;

    const createdQuestion = await Question.create({
      userId,
      title,
      body,
      tags,
    });

    return res.status(201).json({
      message: "Successfully created question",
      question: createdQuestion,
    });
  },
);

const createAnswerOnQuestion = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { body } = req.body;
    const { questionId } = req.params;

    const foundQuestion = await Question.findById(questionId);

    if (!foundQuestion) throw new HttpError("Question not found", 404);

    if (foundQuestion.isDeleted || !foundQuestion.isActive)
      throw new HttpError("Question not active", 410);

    const newAnswer = await Answer.create({ questionId, body, userId });

    await redisClient.del(`question:${questionId}`);

    return res
      .status(201)
      .json({ message: "Successfully created answer", answer: newAnswer });
  },
);

const createReplyOnAnswer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { body } = req.body;
    const answerId = req.params.answerId;

    const foundAnswer = await Answer.findById(answerId);

    if (!foundAnswer) throw new HttpError("Answer not found", 404);

    if (foundAnswer.isDeleted || !foundAnswer.isActive)
      throw new HttpError("Answer not active", 410);

    const foundQuestion = await Question.findById(foundAnswer.questionId);

    if (!foundQuestion) throw new HttpError("Question not found", 404);

    if (foundQuestion.isDeleted || !foundQuestion.isActive)
      throw new HttpError("Question not active", 410);

    const newReply = await Reply.create({ answerId, userId, body });

    await redisClient.del(`question:${foundAnswer.questionId}`);

    return res
      .status(201)
      .json({ message: "Successfully created reply", reply: newReply });
  },
);

const vote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user;
  const { targetType, targetId, voteType } = req.body;

  if (targetType === "Question") {
    const cachedQuestion = await redisClient.get(`question:${targetId}`);

    const foundQuestion = cachedQuestion
      ? JSON.parse(cachedQuestion)
      : await Question.findById(targetId);

    if (!foundQuestion) throw new HttpError("Question not found", 404);

    if (foundQuestion.isDeleted || !foundQuestion.isActive)
      throw new HttpError("Question not active", 410);

    const existingVote = await Vote.findOne({
      userId,
      targetType,
      targetId,
    });

    if (existingVote) {
      existingVote.voteType = voteType;
      await existingVote.save();

      await redisClient.del(`question:${targetId}`);

      return res
        .status(200)
        .json({ message: "Vote updated", vote: existingVote });
    }

    const newVote = await Vote.create({
      userId,
      targetType,
      targetId,
      voteType,
    });

    if (voteType === "upvote")
      await prisma.user.update({
        where: { id: foundQuestion.userId as string },
        data: { reputationPoints: { increment: 10 } },
      });

    await redisClient.del(`question:${targetId}`);

    return res.status(200).json({
      message: `Successfully ${voteType === "upvote" ? "upvoted" : "downvoted"} question`,
      vote: newVote,
    });
  }

  if (targetType === "Answer") {
    const foundAnswer = await Answer.findById(targetId);

    if (!foundAnswer) throw new HttpError("Answer not found", 404);

    if (foundAnswer.isDeleted || !foundAnswer.isActive)
      throw new HttpError("Answer not active", 410);

    const existingVote = await Vote.findOne({
      userId,
      targetType,
      targetId,
    });

    if (existingVote) {
      existingVote.voteType = voteType;
      await existingVote.save();

      await redisClient.del(`question:${foundAnswer.questionId}`);

      return res
        .status(200)
        .json({ message: "Vote updated", vote: existingVote });
    }

    const newVote = await Vote.create({
      userId,
      targetType,
      targetId,
      voteType,
    });

    if (voteType === "upvote")
      await prisma.user.update({
        where: { id: foundAnswer.userId as string },
        data: { reputationPoints: { increment: 10 } },
      });

    await redisClient.del(`question:${foundAnswer.questionId}`);

    return res.status(200).json({
      message: `Successfully ${voteType === "upvote" ? "upvoted" : "downvoted"} answer`,
      vote: newVote,
    });
  }

  if (targetType === "Reply") {
    const foundReply = await Reply.findById(targetId);

    if (!foundReply) throw new HttpError("Reply not found", 404);

    if (foundReply.isDeleted || !foundReply.isActive)
      throw new HttpError("Reply not active", 410);

    const foundAnswer = await Answer.findById(foundReply.answerId);
    if (!foundAnswer) throw new HttpError("Parent answer not found", 404);

    const existingVote = await Vote.findOne({
      userId,
      targetType,
      targetId,
    });

    if (existingVote) {
      existingVote.voteType = voteType;
      await existingVote.save();

      await redisClient.del(`question:${foundAnswer.questionId}`);

      return res
        .status(200)
        .json({ message: "Vote updated", vote: existingVote });
    }

    const newVote = await Vote.create({
      userId,
      targetType,
      targetId,
      voteType,
    });

    if (voteType === "upvote")
      await prisma.user.update({
        where: { id: foundReply.userId as string },
        data: { reputationPoints: { increment: 5 } },
      });

    await redisClient.del(`question:${foundAnswer.questionId}`);

    return res.status(200).json({
      message: `Successfully ${voteType === "upvote" ? "upvoted" : "downvoted"} reply`,
      vote: newVote,
    });
  }
});

const unvote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { targetType, targetId } = req.body;

    const foundVote = await Vote.findOne({ userId, targetType, targetId });

    if (!foundVote) throw new HttpError("Vote not found", 404);

    await Vote.deleteOne({ userId, targetType, targetId });

    if (targetType === "Question" && foundVote.voteType === "upvote") {
      const cachedQuestion = await redisClient.get(`question:${targetId}`);

      const foundQuestion = cachedQuestion
        ? JSON.parse(cachedQuestion)
        : await Question.findById(targetId);

      if (!foundQuestion) throw new HttpError("Question not found", 404);

      if (foundQuestion.isDeleted || !foundQuestion.isActive)
        throw new HttpError("Question not active", 410);

      await prisma.user.update({
        where: { id: foundQuestion.userId as string },
        data: { reputationPoints: { decrement: 10 } },
      });
    }

    if (targetType === "Answer" && foundVote.voteType === "upvote") {
      const foundAnswer = await Answer.findById(targetId);

      if (!foundAnswer) throw new HttpError("Question not found", 404);

      if (foundAnswer.isDeleted || !foundAnswer.isActive)
        throw new HttpError("Question not active", 410);

      await prisma.user.update({
        where: { id: foundAnswer.userId as string },
        data: { reputationPoints: { decrement: 10 } },
      });
    }

    if (targetType === "Reply" && foundVote.voteType === "upvote") {
      const foundReply = await Reply.findById(targetId);

      if (!foundReply) throw new HttpError("Question not found", 404);

      if (foundReply.isDeleted || !foundReply.isActive)
        throw new HttpError("Question not active", 410);

      await prisma.user.update({
        where: { id: foundReply.userId as string },
        data: { reputationPoints: { decrement: 5 } },
      });
    }

    await invalidateCacheOnUnvote(targetType, targetId);

    return res.status(200).json({ message: "Successfully unvoted" });
  },
);

export {
  createQuestion,
  createAnswerOnQuestion,
  createReplyOnAnswer,
  vote,
  unvote,
};
