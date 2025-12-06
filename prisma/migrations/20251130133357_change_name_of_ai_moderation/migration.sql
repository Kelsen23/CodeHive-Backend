/*
  Warnings:

  - The values [AI] on the enum `BannedBy` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BannedBy_new" AS ENUM ('ADMIN', 'MOD', 'AI_MODERATION');
ALTER TABLE "User" ALTER COLUMN "bannedBy" TYPE "BannedBy_new" USING ("bannedBy"::text::"BannedBy_new");
ALTER TYPE "BannedBy" RENAME TO "BannedBy_old";
ALTER TYPE "BannedBy_new" RENAME TO "BannedBy";
DROP TYPE "public"."BannedBy_old";
COMMIT;
