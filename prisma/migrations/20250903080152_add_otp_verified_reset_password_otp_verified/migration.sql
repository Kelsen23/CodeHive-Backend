-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "otpVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resetPasswordOtpVerified" BOOLEAN;
