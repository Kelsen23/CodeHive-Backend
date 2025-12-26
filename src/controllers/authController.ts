import { Request, Response, NextFunction } from "express";

import asyncHandler from "../middlewares/asyncHandler.js";

import AuthenticatedRequest from "../types/authenticatedRequest.js";

import bcrypt from "bcrypt";

import generateToken from "../utils/generateToken.js";
import getDeviceInfo from "../utils/getDeviceInfo.js";
import generateUniqueUsername from "../utils/generateUniqueUsername.js";

import {
  resetPasswordHtml,
  verificationHtml,
} from "../utils/renderTemplate.js";

import HttpError from "../utils/httpError.js";

import prisma from "../config/prisma.js";
import { redisCacheClient } from "../config/redis.js";

import verificationQueue from "../queues/emails/verificationQueue.js";
import resetPasswordQueue from "../queues/emails/resetPasswordQueue.js";

const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  const emailExists = await prisma.user.findUnique({ where: { email } });
  if (emailExists) throw new HttpError("Email is already in use", 400);

  const usernameExists = await prisma.user.findUnique({ where: { username } });
  if (usernameExists) throw new HttpError("Username is taken", 400);

  const genSalt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, genSalt);

  const newUser = await prisma.user.create({
    data: { username, email, password: hashedPassword },
  });
  generateToken(res, newUser.id);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpireAt = new Date(Date.now() + 2 * 60 * 1000);
  const otpResendAvailableAt = new Date(Date.now() + 30 * 1000);

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { otp, otpExpireAt, otpResendAvailableAt },
  });

  const deviceInfo = getDeviceInfo(req);
  const deviceName = `${deviceInfo.browser} on ${deviceInfo.os}`;
  const htmlContent = verificationHtml(
    username,
    otp,
    deviceName,
    deviceInfo.ip || "Unknown IP",
  );

  await verificationQueue.add(
    "sendVerificationEmail",
    {
      email: updatedUser.email,
      htmlContent,
    },
    { removeOnComplete: true, removeOnFail: true },
  );

  return res.status(200).json({
    message: "Successfully registered",
    user: {
      username: updatedUser.username,
      email: updatedUser.email,
      otpExpireAt: updatedUser.otpExpireAt,
      otpResendAvailableAt: updatedUser.otpResendAvailableAt,
      isVerified: updatedUser.isVerified,
    },
  });
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const foundUser = await prisma.user.findUnique({ where: { email } });
  if (!foundUser) throw new HttpError("Email not found", 404);

  if (!foundUser.password)
    throw new HttpError("This account uses Google/GitHub login only", 400);

  const isPasswordCorrect = await bcrypt.compare(password, foundUser.password);
  if (!isPasswordCorrect) throw new HttpError("Invalid password", 401);

  generateToken(res, foundUser.id);

  return res.json({
    message: "Successfully logged in",
    user: {
      username: foundUser.username,
      email: foundUser.email,
      otpExpireAt: foundUser.otpExpireAt,
      otpResendAvailableAt: foundUser.otpResendAvailableAt,
      isVerified: foundUser.isVerified,
    },
  });
});

const registerOrLogin = asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.body;

  if (provider === "google") {
    const { email, name, picture, email_verified } = req.body;

    if (!email_verified)
      throw new HttpError("Email not verified, couldn't register", 400);

    const foundUser = await prisma.user.findUnique({ where: { email } });

    if (!foundUser) {
      const uniqueUsername = await generateUniqueUsername(name);

      const newUser = await prisma.user.create({
        data: {
          username: uniqueUsername,
          email,
          profilePictureUrl: picture,
          isVerified: true,
        },
      });
      generateToken(res, newUser.id);

      return res.status(200).json({
        message: "Successfully registered",
        user: {
          username: newUser.username,
          email: newUser.email,
        },
      });
    } else {
      if (foundUser.password)
        throw new HttpError("User is already registered with this email", 400);

      generateToken(res, foundUser.id);

      return res.status(200).json({
        message: "Successfully logged in",
        user: {
          username: foundUser.username,
          email: foundUser.email,
        },
      });
    }
  }

  if (provider === "github") {
    const { name, email, avatar_url } = req.body;

    const foundUser = await prisma.user.findUnique({ where: { email } });

    if (!foundUser) {
      const uniqueUsername = await generateUniqueUsername(name);

      const newUser = await prisma.user.create({
        data: {
          username: uniqueUsername,
          email,
          profilePictureUrl: avatar_url,
          isVerified: true,
        },
      });

      generateToken(res, newUser.id);

      return res.status(200).json({
        message: "Successfully registered",
        user: { username: newUser.username, email: newUser.email },
      });
    } else {
      if (foundUser.password)
        throw new HttpError("User is already registered with this email", 400);

      generateToken(res, foundUser.id);

      return res.status(200).json({
        message: "Successfully logged in",
        user: { username: foundUser.username, email: foundUser.email },
      });
    }
  }
});

const verifyEmail = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;
    const { otp: inputOtp } = req.body;

    const foundUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!foundUser) throw new HttpError("User not found", 404);

    if (foundUser.isVerified) throw new HttpError("User already verified", 400);

    if (
      !foundUser.otpExpireAt ||
      !foundUser.otpResendAvailableAt ||
      !foundUser.otp
    ) {
      throw new HttpError("OTP not set", 400);
    }

    if (foundUser.otpExpireAt < new Date(Date.now())) {
      throw new HttpError("OTP expired", 400);
    }

    if (foundUser.otp !== inputOtp) throw new HttpError("Invalid OTP", 400);

    const verifiedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        otp: null,
        otpExpireAt: null,
        otpResendAvailableAt: null,
      },
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
    } = verifiedUser;

    await redisCacheClient.set(
      `user:${verifiedUser.id}`,
      JSON.stringify(userWithoutSensitiveInfo),
      "EX",
      60 * 20,
    );

    res.status(200).json({
      message: "Successfully verified",
      user: {
        username: verifiedUser.username,
        email: verifiedUser.email,
        isVerified: verifiedUser.isVerified,
      },
    });
  },
);

const resendVerificationEmail = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;

    const foundUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!foundUser) throw new HttpError("User not found", 404);

    if (foundUser.isVerified) throw new HttpError("User already verified", 400);

    if (
      !foundUser.otpExpireAt ||
      !foundUser.otpResendAvailableAt ||
      !foundUser.otp
    )
      throw new HttpError("OTP not set", 400);

    if (foundUser.otpResendAvailableAt > new Date(Date.now()))
      throw new HttpError(
        "OTP resend will soon be available, please wait",
        400,
      );

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpireAt = new Date(Date.now() + 2 * 60 * 1000);
    const otpResendAvailableAt = new Date(Date.now() + 30 * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { otp, otpExpireAt, otpResendAvailableAt },
    });

    if (!updatedUser.otp) throw new HttpError("OTP not set", 400);

    const deviceInfo = getDeviceInfo(req);
    const deviceName = `${deviceInfo.browser} on ${deviceInfo.os}`;
    const htmlContent = verificationHtml(
      updatedUser.username,
      updatedUser.otp,
      deviceName,
      deviceInfo.ip || "Unknown IP",
    );

    await verificationQueue.add(
      "resendVerificationEmail",
      {
        email: updatedUser.email,
        htmlContent,
      },
      { removeOnComplete: true, removeOnFail: true },
    );

    return res.status(200).json({
      message: "Successfully sent another OTP to your email address",
    });
  },
);

const sendResetPasswordEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const foundUser = await prisma.user.findUnique({ where: { email } });

    if (!foundUser) throw new HttpError("User not found", 404);

    if (foundUser.resetPasswordOtp && foundUser.resetPasswordOtpExpireAt)
      if (foundUser.resetPasswordOtpExpireAt > new Date(Date.now()))
        throw new HttpError("Reset password OTP already sent", 400);

    const resetPasswordOtp = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const resetPasswordOtpExpireAt = new Date(Date.now() + 2 * 60 * 1000);
    const resetPasswordOtpResendAvailableAt = new Date(Date.now() + 30 * 1000);

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        resetPasswordOtp,
        resetPasswordOtpExpireAt,
        resetPasswordOtpResendAvailableAt,
        resetPasswordOtpVerified: false,
      },
    });

    if (!updatedUser.resetPasswordOtp) throw new HttpError("OTP not set", 400);

    const deviceInfo = getDeviceInfo(req);
    const deviceName = `${deviceInfo.browser} on ${deviceInfo.os}`;

    const htmlContent = resetPasswordHtml(
      updatedUser.username,
      updatedUser.resetPasswordOtp,
      deviceName,
      deviceInfo.ip || "Unknown IP",
    );

    await resetPasswordQueue.add(
      "sendResetPasswordEmail",
      {
        email: updatedUser.email,
        htmlContent,
      },
      { removeOnComplete: true, removeOnFail: true },
    );

    return res
      .status(200)
      .json({ message: "Successfully sent reset password OTP" });
  },
);

const resendResetPasswordEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const foundUser = await prisma.user.findUnique({ where: { email } });

    if (!foundUser) throw new HttpError("User not found", 404);

    if (
      !foundUser.resetPasswordOtp ||
      !foundUser.resetPasswordOtpExpireAt ||
      !foundUser.resetPasswordOtpResendAvailableAt
    )
      throw new HttpError("Reset password OTP not set", 400);

    if (foundUser.resetPasswordOtpResendAvailableAt > new Date(Date.now()))
      throw new HttpError(
        "OTP resend will soon be available, please wait",
        400,
      );

    const resetPasswordOtp = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const resetPasswordOtpExpireAt = new Date(Date.now() + 2 * 60 * 1000);
    const resetPasswordOtpResendAvailableAt = new Date(Date.now() + 30 * 1000);

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        resetPasswordOtp,
        resetPasswordOtpExpireAt,
        resetPasswordOtpResendAvailableAt,
        resetPasswordOtpVerified: false,
      },
    });

    if (!updatedUser.resetPasswordOtp) throw new HttpError("OTP not set", 400);

    const deviceInfo = getDeviceInfo(req);
    const deviceName = `${deviceInfo.browser} on ${deviceInfo.os}`;

    const htmlContent = resetPasswordHtml(
      updatedUser.username,
      updatedUser.resetPasswordOtp,
      deviceName,
      deviceInfo.ip || "Unknown IP",
    );

    await resetPasswordQueue.add(
      "resendResetPasswordEmail",
      {
        email: updatedUser.email,
        htmlContent,
      },
      { removeOnComplete: true, removeOnFail: true },
    );

    return res
      .status(200)
      .json({ message: "Successfully sent reset password OTP" });
  },
);

const verifyResetPasswordOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;

    const foundUser = await prisma.user.findUnique({ where: { email } });

    if (!foundUser) throw new HttpError("User not found", 404);

    if (
      !foundUser.resetPasswordOtp ||
      !foundUser.resetPasswordOtpExpireAt ||
      !foundUser.resetPasswordOtpResendAvailableAt
    )
      throw new HttpError("Reset password OTP not set", 400);

    if (foundUser.resetPasswordOtpExpireAt < new Date(Date.now()))
      throw new HttpError("Reset password OTP expired", 400);

    if (foundUser.resetPasswordOtp !== otp)
      throw new HttpError("Invalid OTP", 400);

    await prisma.user.update({
      where: { id: foundUser.id },
      data: {
        resetPasswordOtpVerified: true,
        resetPasswordOtp: null,
        resetPasswordOtpExpireAt: null,
        resetPasswordOtpResendAvailableAt: null,
      },
    });

    res.status(200).json({ message: "Successfully verified OTP" });
  },
);

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;

  const foundUser = await prisma.user.findUnique({ where: { email } });

  if (!foundUser) throw new HttpError("User not found", 404);

  if (!foundUser.resetPasswordOtpVerified)
    throw new HttpError("OTP not verified", 400);

  const isSamePassword = await bcrypt.compare(
    newPassword,
    foundUser.password as string,
  );

  if (isSamePassword)
    throw new HttpError(
      "New password must be different from the old password",
      400,
    );

  const genSalt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, genSalt);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      resetPasswordOtp: null,
      resetPasswordOtpExpireAt: null,
      resetPasswordOtpResendAvailableAt: null,
      resetPasswordOtpVerified: null,
    },
  });

  res.status(200).json({ message: "Successfully updated your password" });
});

const isAuth = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user;

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

    return res.status(200).json({
      message: "Successfully authenticated",
      user: userWithoutSensitiveInfo,
    });
  },
);

const logout = asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });

  return res.status(200).json({ message: "Logged Out" });
});

export {
  register,
  login,
  registerOrLogin,
  verifyEmail,
  resendVerificationEmail,
  sendResetPasswordEmail,
  resendResetPasswordEmail,
  verifyResetPasswordOtp,
  resetPassword,
  isAuth,
  logout,
};
