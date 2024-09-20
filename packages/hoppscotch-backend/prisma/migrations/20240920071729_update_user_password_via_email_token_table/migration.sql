/*
  Warnings:

  - The primary key for the `UserPasswordViaEmailToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `uid` on the `UserPasswordViaEmailToken` table. All the data in the column will be lost.
  - The required column `id` was added to the `UserPasswordViaEmailToken` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `userUid` to the `UserPasswordViaEmailToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserPasswordViaEmailToken" DROP CONSTRAINT "UserPasswordViaEmailToken_pkey",
DROP COLUMN "uid",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userUid" TEXT NOT NULL,
ADD CONSTRAINT "UserPasswordViaEmailToken_pkey" PRIMARY KEY ("id");
