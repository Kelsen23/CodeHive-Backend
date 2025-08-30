-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "otpResendAvailableAt" TIMESTAMP(3),
ADD COLUMN     "resetPasswordOtpResendAvailableAt" TIMESTAMP(3);
