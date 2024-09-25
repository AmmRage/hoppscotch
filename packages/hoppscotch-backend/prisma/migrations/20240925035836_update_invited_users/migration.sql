/*
  Warnings:

  - Added the required column `inviteEmailStatus` to the `InvitedUsers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InvitedUsers" ADD COLUMN     "inviteEmailStatus" BOOLEAN NOT NULL;
