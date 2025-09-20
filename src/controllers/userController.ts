import { Request, Response, NextFunction } from "express";

import asyncHandler from "../middlewares/asyncHandler.js";

import { prisma } from "../index.js";
import { redisClient } from "../config/redis.js";

import HttpError from "../utils/httpError.js";
import interests from "../utils/interests.js";

interface AuthenticatedRequest extends Request {
  cookies: {
    token?: any;
  };
  user?: any;
}

const updateProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;

    const foundUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!foundUser) throw new HttpError("User not found", 404);

    const { username, bio } = req.body;

    if (username && username !== foundUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username },
      });
      if (usernameExists) throw new HttpError("Username is already taken", 400);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username, bio },
    });
    const {
      password,
      profilePictureKey,
      otp,
      otpResendAvailableAt,
      otpExpireAt,
      resetPasswordOtp,
      resetPasswordOtpVerified,
      resetPasswordOtpResendAvailableAt,
      resetPasswordOtpExpireAt,
      ...userWithoutSensitiveInfo
    } = updatedUser;

    await redisClient.set(
      `user:${updatedUser.id}`,
      JSON.stringify(userWithoutSensitiveInfo),
      "EX",
      60 * 60,
    );

    return res.status(200).json({
      message: "Successfully updated profile",
      user: userWithoutSensitiveInfo,
    });
  },
);

const getInterests = asyncHandler(async (req: Request, res: Response) => {
  return res.status(200).json({ interests });
});

const saveInterests = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { interests } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { interests },
    });

    return res.status(200).json({
      message: "Successfully saved interests",
      interests: updatedUser.interests,
    });
  },
);
export { updateProfile, getInterests, saveInterests };
