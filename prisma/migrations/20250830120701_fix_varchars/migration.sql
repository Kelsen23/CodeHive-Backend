/*
  Warnings:

  - You are about to alter the column `password` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(345)` to `VarChar(60)`.

*/
-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "email" SET DATA TYPE VARCHAR(345),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(60);
