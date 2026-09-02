-- MARRIAGE_BOT contact-admin inbox (owner spec, 2026-09-02). Run once in
-- Supabase's SQL Editor.

CREATE TABLE IF NOT EXISTS "AdminMessage" (
    "id"         TEXT NOT NULL,
    "senderId"   TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
