import asyncHandler from "../middlewares/asyncHandler.js";

import { Request, Response } from "express";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import Question from "../models/questionModel.js";
import Answer from "../models/answerModel.js";

import HttpError from "../utils/httpError.js";

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
      throw new HttpError("Question not active", 404);

    const newAnswer = await Answer.create({ questionId, body, userId });

    return res
      .status(201)
      .json({ message: "Successfully created answer", answer: newAnswer });
  },
);

export { createQuestion, createAnswerOnQuestion };
