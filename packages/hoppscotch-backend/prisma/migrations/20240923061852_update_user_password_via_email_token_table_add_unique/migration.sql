/*
  Warnings:

  - A unique constraint covering the columns `[userUid]` on the table `UserPasswordViaEmailToken` will be added. If there are existing duplicate values, this will fail.
  - Made the column `email` on table `UserPasswordViaEmailToken` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UserPasswordViaEmailToken" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserPasswordViaEmailToken_userUid_key" ON "UserPasswordViaEmailToken"("userUid");
