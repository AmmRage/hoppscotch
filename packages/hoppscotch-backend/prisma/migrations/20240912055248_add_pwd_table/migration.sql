-- DropIndex
DROP INDEX "TeamCollection_title_trgm_idx";

-- DropIndex
DROP INDEX "TeamRequest_title_trgm_idx";

-- CreateTable
CREATE TABLE "UserPasswordViaEmailToken" (
    "uid" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT,
    "password" TEXT,

    CONSTRAINT "UserPasswordViaEmailToken_pkey" PRIMARY KEY ("uid")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPasswordViaEmailToken_email_key" ON "UserPasswordViaEmailToken"("email");
