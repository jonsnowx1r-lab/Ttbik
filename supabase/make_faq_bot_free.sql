-- Makes both "الرد والدعم" bots مجانية: بوت الأسئلة الشائعة (faq-bot) —
-- شُغّل من قبل — وبوت الرد الآلي (auto-reply-bot). آمن للتشغيل حتى لو
-- كررت السطر الأول، فهو idempotent.
-- شغّله في Supabase → SQL Editor → Run.
UPDATE services SET price_usd = 0 WHERE slug = 'faq-bot';
UPDATE services SET price_usd = 0 WHERE slug = 'auto-reply-bot';
