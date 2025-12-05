/*
  Warnings:

  - You are about to drop the column `banExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `banReasons` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `banType` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `bannedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `bannedBy` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isBanned` on the `User` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Achievement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('ONE', 'TWO', 'THREE', 'FOUR', 'FIVE');

-- CreateEnum
CREATE TYPE "MODS" AS ENUM ('HUMAN', 'AI_MODERATION');

-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "banExpiresAt",
DROP COLUMN "banReasons",
DROP COLUMN "banType",
DROP COLUMN "bannedAt",
DROP COLUMN "bannedBy",
DROP COLUMN "isBanned",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "BannedBy";

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(30) NOT NULL,
    "reasons" TEXT[],
    "severity" "SeverityLevel" NOT NULL,
    "warnedBy" "MODS" NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(30) NOT NULL,
    "reasons" TEXT[],
    "banType" "BanType" NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "bannedBy" "MODS" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
