-- CreateEnum
CREATE TYPE "SelfTestType" AS ENUM ('BIG_FIVE', 'SIXTEEN_TYPES', 'TRAUMA', 'HEARTBREAK', 'LOVE_LANGUAGE');

-- AlterEnum
ALTER TYPE "CrisisTrigger" ADD VALUE 'SELF_TEST_ITEM';

-- CreateTable
CREATE TABLE "SelfTestResult" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SelfTestType" NOT NULL,
    "resultEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelfTestResult_userId_createdAt_idx" ON "SelfTestResult"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SelfTestResult" ADD CONSTRAINT "SelfTestResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
