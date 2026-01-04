import { Request, Response, NextFunction } from "express";

import asyncHandler from "../middlewares/asyncHandler.js";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import HttpError from "../utils/httpError.js";
import interests from "../utils/interests.js";

import { redisCacheClient } from "../config/redis.js";
import prisma from "../config/prisma.js";

const updateProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { username, bio } = req.body;

    const cachedUser = await redisCacheClient.get(`user:${userId}`);
    const foundUser = cachedUser
      ? JSON.parse(cachedUser)
      : await prisma.user.findUnique({ where: { id: userId } });

    if (!foundUser) throw new HttpError("User not found", 404);

    if (username === foundUser.username) {
      if (bio === foundUser.bio)
        throw new HttpError("Username and bio already used", 400);
    } else {
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

    await redisCacheClient.set(
      `user:${updatedUser.id}`,
      JSON.stringify(userWithoutSensitiveInfo),
      "EX",
      60 * 20,
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
    const userId = req.user.id;
    const { interests } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { interests },
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

    await redisCacheClient.set(
      `user:${updatedUser.id}`,
      JSON.stringify(userWithoutSensitiveInfo),
      "EX",
      60 * 20,
    );

    return res.status(200).json({
      message: "Successfully saved interests",
      interests: updatedUser.interests,
    });
  },
);

export { updateProfile, getInterests, saveInterests };
