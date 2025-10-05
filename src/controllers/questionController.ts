import asyncHandler from "../middlewares/asyncHandler.js";

import { Request, Response } from "express";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import Question from "../models/questionModel.js";

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

export { createQuestion };
