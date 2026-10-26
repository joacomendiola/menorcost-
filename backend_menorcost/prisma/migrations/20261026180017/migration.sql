/*
  Warnings:

  - Made the column `logo_url` on table `comercio` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "comercio" ALTER COLUMN "logo_url" SET NOT NULL;
