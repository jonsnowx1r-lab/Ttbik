-- Adds User.language for the AR/EN preference. Run once in Supabase SQL Editor.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'ar';
