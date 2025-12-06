/*
  Warnings:

  - You are about to drop the column `banReason` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "banReason",
ADD COLUMN     "banReasons" TEXT[];
