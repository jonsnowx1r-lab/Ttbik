-- One-time setup for the new Prisma-based bot platform tables.
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Generated via: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "AdType" AS ENUM ('LINK', 'TELEGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'BOT_OWNER', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ownerBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "depositAddress" TEXT,
    "referredBy" TEXT,
    "pendingAction" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "type" "AdType" NOT NULL,
    "content" TEXT NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "cpc" DOUBLE PRECISION NOT NULL,
    "ownerCut" DOUBLE PRECISION NOT NULL,
    "creatorCut" DOUBLE PRECISION NOT NULL,
    "workerCut" DOUBLE PRECISION NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bot_token_key" ON "Bot"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
