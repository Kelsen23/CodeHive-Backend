-- CreateEnum
CREATE TYPE "Auth_Provider" AS ENUM ('LOCAL', 'GOOGLE', 'GITHUB');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" "Auth_Provider" NOT NULL DEFAULT 'LOCAL';
