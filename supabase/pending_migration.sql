-- Hosted Telegram bots on Ttbik. Run in Supabase SQL editor once.

create table if not exists public.hosted_bots (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  template_type text not null,
  bot_token text not null,
  bot_username text,
  bot_tg_id text,
  owner_contact text not null,
  welcome_text text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  webhook_secret text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_members (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  username text,
  display_name text,
  points integer not null default 0,
  unique (bot_id, tg_user_id)
);

create table if not exists public.bot_wallet_tx (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  kind text not null,
  amount numeric not null,
  status text not null default 'pending',
  payment_method text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_ads (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  title text not null,
  reward_points integer not null default 1,
  is_active boolean not null default true
);

create table if not exists public.bot_appointments (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  display_name text,
  slot_label text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.hosted_bots enable row level security;
alter table public.bot_members enable row level security;
alter table public.bot_wallet_tx enable row level security;
alter table public.bot_ads enable row level security;
alter table public.bot_appointments enable row level security;

-- Same lesson as earlier in this project: RLS alone does not grant access.
-- These tables were created via SQL Editor, so service_role (used by every
-- /api/bots/* route through supabaseAdmin()) needs an explicit GRANT — RLS
-- BYPASSRLS only skips policy checks, it does not skip base table privileges.
-- Root cause of "permission denied for table hosted_bots" in production.
grant select, insert, update, delete on
  public.hosted_bots, public.bot_members, public.bot_wallet_tx,
  public.bot_ads, public.bot_appointments
to service_role;

-- Purchasable service unlocking access to /bots (the hosted-bot builder).
-- /api/bots/create requires an approved order for a service whose slug/
-- tool_route/name contains "bot"/"بوت"/"telegram"/"تليجرام" — this is that
-- service, giving customers a direct, obvious thing to order instead of
-- having to realize any bot-related service's order code happens to work.
insert into services (category_id, slug, name_ar, subcategory, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, tool_route, sort_order)
select id, 'hosted-bot-builder', 'إنشاء بوت مستضاف بقالب جاهز', 'الإعلانات والتسويق',
  'اختر قالباً (حملة إعلانية، متجر، عيادة)، ضع توكن بوتك، ونشغّله فعلياً على استضافة الموقع.',
  'بعد الموافقة على طلبك، استخدم رمز الطلب في صفحة /bots لتفعيل بوتك بالقالب الذي تختاره. النقاط داخل البوت للاستخدام الداخلي فقط، بلا سحب نقدي — الإيداع فقط عبر تحويل بنكي أو USDT بموافقة يدوية.',
  15, 'bot_simulator', 'text', 'اذهب إلى /bots، اختر قالباً، وأدخل رمز طلبك لتفعيل البوت.', null, 6
from categories where slug = 'telegram-bots'
on conflict (slug) do nothing;
