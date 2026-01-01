/*
  Warnings:

  - Changed the type of `severity` on the `Ban` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `severity` on the `Warning` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Ban" DROP COLUMN "severity",
ADD COLUMN     "severity" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Warning" DROP COLUMN "severity",
ADD COLUMN     "severity" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "SeverityLevel";
