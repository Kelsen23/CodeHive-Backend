import asyncHandler from "../middlewares/asyncHandler.js";

import { Request, Response } from "express";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import invalidateCacheOnUnvote from "../utils/invalidateCacheOnUnvote.js";
import HttpError from "../utils/httpError.js";

import mongoose from "mongoose";
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

    let { targetType } = req.params;
    const { targetId } = req.params;

    if (
      targetType !== "question" &&
      targetType !== "answer" &&
      targetType !== "reply"
    )
      throw new HttpError("Invalid target type", 400);

    targetType = targetType.charAt(0).toUpperCase() + targetType.slice(1);

    if (
      typeof targetId !== "string" ||
      !mongoose.Types.ObjectId.isValid(targetId)
    ) {
      throw new HttpError("Invalid targetId", 400);
    }

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

    await invalidateCacheOnUnvote(
      targetType as "Question" | "Answer" | "Reply",
      targetId,
    );

    return res.status(200).json({ message: "Successfully unvoted" });
  },
);

const markAnswerAsBest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { answerId } = req.params;

    const foundAnswer = await Answer.findById(answerId);

    if (!foundAnswer) throw new HttpError("Answer not found", 404);

    if (foundAnswer.isDeleted || !foundAnswer.isActive)
      throw new HttpError("Answer not active", 410);

    if (foundAnswer.isBestAnswerByAsker) {
      return res.status(200).json({
        message: "Answer is already marked as best",
        answer: foundAnswer,
      });
    }

    const cachedQuestion = await redisClient.get(
      `question:${foundAnswer.questionId}`,
    );

    const foundQuestion = cachedQuestion
      ? JSON.parse(cachedQuestion)
      : await Question.findById(foundAnswer.questionId);

    if (!foundQuestion) throw new HttpError("Question not found", 404);

    if (foundQuestion.userId !== userId)
      throw new HttpError("Unauthorized to mark as best answer", 403);

    if (foundQuestion.isDeleted || !foundQuestion.isActive)
      throw new HttpError("Question not active", 410);

    const bestAnswer = await Answer.findOne({
      questionId: foundAnswer.questionId,
      isBestAnswerByAsker: true,
    });

    if (bestAnswer) {
      await Answer.findByIdAndUpdate(bestAnswer._id, {
        $set: { isBestAnswerByAsker: false },
      });

      await prisma.user.update({
        where: { id: bestAnswer.userId as string },
        data: { reputationPoints: { decrement: 15 } },
      });
    }

    const newBestAnswer = await Answer.findByIdAndUpdate(foundAnswer._id, {
      $set: { isBestAnswerByAsker: true },
    });

    if (!newBestAnswer)
      throw new HttpError("Error marking answer as best", 500);

    await prisma.user.update({
      where: { id: newBestAnswer.userId as string },
      data: { reputationPoints: { increment: 15 } },
    });

    await redisClient.del(`question:${foundAnswer.questionId}`);

    return res.status(200).json({
      message: "Successfully marked answer as best",
      answer: newBestAnswer,
    });
  },
);

const deleteContent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { targetType, targetId } = req.params;

    const validTargetTypes = ["question", "answer", "reply"] as const;
    type TargetType = (typeof validTargetTypes)[number];

    if (!validTargetTypes.includes(targetType as TargetType)) {
      throw new HttpError("Invalid target type", 400);
    }

    if (
      typeof targetId !== "string" ||
      !mongoose.Types.ObjectId.isValid(targetId)
    ) {
      throw new HttpError("Invalid targetId", 400);
    }

    if (targetType === "question") {
      const cachedQuestion = await redisClient.get(`question:${targetId}`);

      const foundQuestion = cachedQuestion
        ? JSON.parse(cachedQuestion)
        : await Question.findById(targetId);

      if (!foundQuestion) throw new HttpError("Question not found", 404);

      if (foundQuestion.userId !== userId)
        throw new HttpError("Unauthorized to delete question", 403);

      if (foundQuestion.isDeleted || !foundQuestion.isActive)
        throw new HttpError("Question not active", 410);

      await Question.findByIdAndUpdate(foundQuestion._id, {
        $set: { isDeleted: true, isActive: false },
      });

      await redisClient.del(`question:${targetId}`);

      return res.status(200).json({
        message: "Successfully deleted question",
      });
    }

    if (targetType === "answer") {
      const foundAnswer = await Answer.findById(targetId);

      if (!foundAnswer) throw new HttpError("Answer not found", 404);

      if (foundAnswer.userId !== userId)
        throw new HttpError("Unauthorized to delete answer", 403);

      if (foundAnswer.isDeleted || !foundAnswer.isActive)
        throw new HttpError("Answer not active", 410);

      await Answer.findByIdAndUpdate(foundAnswer._id, {
        $set: { isDeleted: true, isActive: false },
      });

      await redisClient.del(`question:${foundAnswer.questionId}`);

      return res.status(200).json({
        message: "Successfully deleted answer",
      });
    }

    if (targetType === "reply") {
      const foundReply = await Reply.findById(targetId);

      if (!foundReply) throw new HttpError("Reply not found", 404);

      if (foundReply.userId !== userId)
        throw new HttpError("Unauthorized to delete reply", 403);

      if (foundReply.isDeleted || !foundReply.isActive)
        throw new HttpError("Reply not active", 410);

      await Reply.findByIdAndUpdate(foundReply._id, {
        $set: { isDeleted: true, isActive: false },
      });

      const foundAnswer = await Answer.findById(foundReply.answerId);

      if (!foundAnswer) throw new HttpError("Parent answer not found", 404);

      await redisClient.del(`question:${foundAnswer.questionId}`);

      return res.status(200).json({
        message: "Successfully deleted reply",
      });
    }
  },
);

export {
  createQuestion,
  createAnswerOnQuestion,
  createReplyOnAnswer,
  vote,
  unvote,
  markAnswerAsBest,
  deleteContent,
};
