-- Makes "بوت الأسئلة الشائعة" (faq-bot, في قسم "الرد والدعم") مجانياً.
-- شغّله مرة واحدة في Supabase → SQL Editor → Run.
UPDATE services SET price_usd = 0 WHERE slug = 'faq-bot';
