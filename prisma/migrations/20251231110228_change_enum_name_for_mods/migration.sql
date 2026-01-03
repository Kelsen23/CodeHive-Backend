/*
  Warnings:

  - The values [HUMAN] on the enum `MODS` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MODS_new" AS ENUM ('ADMIN_MODERATION', 'AI_MODERATION');
ALTER TABLE "Warning" ALTER COLUMN "warnedBy" TYPE "MODS_new" USING ("warnedBy"::text::"MODS_new");
ALTER TABLE "Ban" ALTER COLUMN "bannedBy" TYPE "MODS_new" USING ("bannedBy"::text::"MODS_new");
ALTER TYPE "MODS" RENAME TO "MODS_old";
ALTER TYPE "MODS_new" RENAME TO "MODS";
DROP TYPE "public"."MODS_old";
COMMIT;
