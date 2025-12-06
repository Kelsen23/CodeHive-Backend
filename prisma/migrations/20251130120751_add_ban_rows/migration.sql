-- CreateEnum
CREATE TYPE "BanType" AS ENUM ('TEMP', 'PERM');

-- CreateEnum
CREATE TYPE "BannedBy" AS ENUM ('ADMIN', 'MOD', 'AI');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banExpiresAt" TIMESTAMP(3),
ADD COLUMN     "banReason" VARCHAR(150),
ADD COLUMN     "banType" "BanType",
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedBy" "BannedBy",
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;
