-- NOVA AI — adds message/answer columns to NovaUsageLog, so every
-- conversation turn doubles as real LoRA fine-tuning data for
-- ai-system/colab/merge_and_finetune.ipynb's scheduled Kaggle run.
-- Nullable so existing rows stay valid. Idempotent, run once in
-- Supabase's SQL Editor.

ALTER TABLE "NovaUsageLog" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "NovaUsageLog" ADD COLUMN IF NOT EXISTS "answer" TEXT;
