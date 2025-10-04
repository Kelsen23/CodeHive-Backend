import jwt from "jsonwebtoken";

import HttpError from "../utils/httpError.js";

import { prisma } from "../index.js";
import { redisClient } from "../config/redis.js";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

const authenticateGraphQLUser = async (req: AuthenticatedRequest) => {
  const token = req.cookies?.token;

  if (!token) throw new HttpError("Not authenticated, no token", 400);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
    };
  } catch (err) {
    throw new HttpError("Not authenticated, token failed", 401);
  }

  const userId = decoded.userId;

  const cachedUser = await redisClient.get(`user:${userId}`);

  if (cachedUser) {
    const cachedUserObj = JSON.parse(cachedUser);

    if (!cachedUserObj.isVerified)
      throw new HttpError("User not verified", 403);

    if (cachedUserObj.status !== "ACTIVE")
      throw new HttpError("User not active", 403);

    return cachedUserObj;
  }

  const foundUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!foundUser) throw new HttpError("User not found", 404);

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
  } = foundUser;

  await redisClient.set(
    `user:${userId}`,
    JSON.stringify(userWithoutSensitiveInfo),
    "EX",
    60 * 20,
  );

  if (!foundUser.isVerified) throw new HttpError("User not verified", 403);
  if (foundUser.status !== "ACTIVE")
    throw new HttpError("User not active", 403);

  return userWithoutSensitiveInfo;
};

export default authenticateGraphQLUser;
