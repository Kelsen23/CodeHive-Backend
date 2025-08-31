/*
  Warnings:

  - You are about to drop the column `isVarified` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "isVarified",
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;
