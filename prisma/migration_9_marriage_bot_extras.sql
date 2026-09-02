-- MARRIAGE_BOT extras (owner spec, 2026-09-02): hide/show toggle on
-- profiles. Run once in Supabase's SQL Editor.

ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
