import jwt from "jsonwebtoken";

import asyncHandler from "./asyncHandler.js";

import { NextFunction, Request, Response } from "express";

import HttpError from "../utils/httpError.js";

interface AuthenticatedRequest extends Request {
  cookies: {
    token?: any;
  };
  user?: any;
}

const isAuthenticated = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.cookies.token;

    if (!token) throw new HttpError("Not authenticated, no token", 400);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId: string;
      };
      req.user = decoded.userId;
      next();
    } catch (error) {
      throw new HttpError("Not authenticated, token failed", 401);
    }
  },
);

export default isAuthenticated;
