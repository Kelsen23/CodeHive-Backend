import { Request, Response, NextFunction } from "express";

import path from "path";

import bcrypt from "bcrypt";

import asyncHandler from "../middlewares/asyncHandler.js";
import generateToken from "../utils/generateToken.js";
import transporter from "../config/nodemailer.js";
import getDeviceInfo from "../utils/getDeviceInfo.js";

import { verificationHtml } from "../utils/renderTemplate.js";

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
}

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

  const otp = Math.floor(10000 + Math.random() * 900000).toString();
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

  try {
    await transporter.sendMail({
      from: `'CodeHive' <${process.env.CODEHIVE_EMAIL}>`,
      to: email,
      subject: "Verify Email",
      html: htmlContent,
      attachments: [
        {
          filename: "CodeHive logo.png",
          path: path.join(process.cwd(), "assets/CodeHive logo.png"),
          cid: "codehive-logo",
        },
      ],
    });
  } catch (error) {
    throw new HttpError(`Failed to send verification email: ${error}`, 500);
  }

  res.status(200).json({
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

export { register };
