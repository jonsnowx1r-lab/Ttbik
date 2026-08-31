-- Adds: mandatory-channel gate, campaign scope/global pool, and bot-scoped
-- transaction attribution (Bot Owner panel + Global Ads features).
-- Run once in Supabase SQL Editor.

ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "requiredChannel" TEXT;

ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'TARGETED';
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "targetBotId" TEXT;

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "botId" TEXT;

-- Backfill: any forced/free platform ad created before this migration (cpc = 0)
-- was meant to show across every bot — mark it GLOBAL so it doesn't become
-- invisible now that "شاهد واربح" filters by scope.
UPDATE "Ad" SET "scope" = 'GLOBAL', "targetBotId" = NULL WHERE "cpc" = 0;

