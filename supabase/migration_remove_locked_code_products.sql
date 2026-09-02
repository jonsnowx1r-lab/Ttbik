-- Owner directive (2026-09-02): the site sells real services now, not
-- locked/closed code files. Run once in Supabase's SQL Editor. Idempotent.

-- 1) Allow the new automated NOWPayments checkout on orders.payment_method
--    (see api/orders/create-invoice + api/orders/payment-webhook).
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('bank', 'usdt', 'crypto_auto'));

-- 2) Retire the remaining locked-code-for-sale products. is_active=false,
--    not a hard DELETE — orders.service_id is "on delete restrict", so a
--    DELETE would simply fail if any customer ever historically ordered
--    one of these (same reasoning already used for the earlier batch in
--    pending_migration.sql). Functionally invisible/unpurchasable either
--    way; ask if you specifically want a hard delete after confirming no
--    historical orders reference them.
update services set is_active = false
where slug in (
  'order-manager-bot', 'ad-slot-bot', 'landing-page-generator',
  'workflow-templates', 'invoice-generator', 'whatsapp-catalog'
);

-- 3) Data-integrity fix found while doing this: faq-bot and auto-reply-bot
--    are both free ($0, see make_faq_bot_free.sql) and are actively linked
--    as live offers from /free-tools (FREE_BOTS array) — but the earlier
--    bulk deactivation in pending_migration.sql set is_active=false on
--    both too, which makes those free-tools links 404. Reactivate them.
update services set is_active = true where slug in ('faq-bot', 'auto-reply-bot');
