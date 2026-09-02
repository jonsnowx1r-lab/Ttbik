-- MARRIAGE_BOT admin-panel additions (owner spec, 2026-09-02): ban/mute on
-- MatchUser, and source/status on MatchReport for the split
-- matching-vs-random-chat report queues. Run once in Supabase's SQL Editor.

ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "mutedUntil" TIMESTAMP(3);

ALTER TABLE "MatchReport" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'SEARCH';
ALTER TABLE "MatchReport" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
