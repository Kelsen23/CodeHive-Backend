-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'MOD', 'USER');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('ACTIVE', 'TERMINATED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(15) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(345) NOT NULL,
    "profilePictureUrl" TEXT,
    "profilePictureKey" TEXT,
    "reputationPoints" INTEGER NOT NULL DEFAULT 0,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "answersGiven" INTEGER NOT NULL DEFAULT 0,
    "bestAnswers" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."Status" NOT NULL DEFAULT 'ACTIVE',
    "otp" CHAR(6),
    "otpExpireAt" TIMESTAMP(3),
    "resetPasswordOtp" CHAR(6),
    "resetPasswordOtpExpireAt" TIMESTAMP(3),
    "isVarified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
