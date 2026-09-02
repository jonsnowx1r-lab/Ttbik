-- Owner directive (2026-09-03): "قسم الترجمة والذكاء" study + merge + cleanup.
-- Run once in Supabase's SQL Editor, AFTER the site is deployed with the
-- two new free tools (writing-assistant, text-analyzer) live — this
-- migration removes the paid listings they replace. Idempotent.
--
-- Study/comparison done first (per the owner's instruction): none of these
-- 7 services ever had a working /tools/[tool] page behind them —
-- src/lib/studioTools.ts only ever registered "audio-visualizer". They
-- were deactivated on 2026-08-30 and have sat unreachable since; nothing
-- to "merge" as working code, only as intent. Checked against every other
-- live service/free tool on the site: no overlap.
--
-- 6 of the 7 were folded into two new free tools:
--   /free-tools/writing-assistant — social-caption-generator, blog-writer,
--     product-description-writer, smart-translator (4 modes, 1 tool)
--   /free-tools/text-analyzer — text-summarizer, review-analyzer
--     (2 modes, 1 tool)
-- ai-chat-assistant (the 7th) was deliberately dropped, not folded in
-- anywhere: an open-ended AI chat is exactly what src/lib/groq.ts's own
-- site-identity prompt says this project is not ("ليس متجراً يبيع وصولاً
-- عاماً لذكاء اصطناعي كمنتج قائم بذاته") — keeping it would just rebuild
-- the thing that made this whole category worth retiring.

delete from services
where slug in (
  'smart-translator', 'text-summarizer', 'ai-chat-assistant', 'review-analyzer',
  'social-caption-generator', 'blog-writer', 'product-description-writer'
);

-- Both categories are now fully empty (0 services) — remove them.
delete from categories where slug in ('ai-translation', 'content-design');
