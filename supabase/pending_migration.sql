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

-- Tracks which member has already been rewarded for which ad, so the same
-- ad can never be claimed twice by the same person (the "الإعلانات" feature
-- was previously just a dead-end message — this table plus the /bots/live
-- page and /api/bots/ads/claim route make it a real watch-and-earn loop).
create table if not exists public.bot_ad_views (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  ad_id uuid not null references public.bot_ads(id) on delete cascade,
  tg_user_id text not null,
  created_at timestamptz not null default now(),
  unique (ad_id, tg_user_id)
);

-- Daily check-in bonus + one-time referral credit tracking on bot_members.
alter table public.bot_members add column if not exists last_checkin date;
alter table public.bot_members add column if not exists referred_by text;

-- Needed for the ad-campaign withdrawal eligibility check (minimum account
-- age before a first withdrawal request, per owner decision 2026-08-29).
-- Existing rows backfill to now() — acceptable since there are no real
-- public users yet (admin-testing phase only).
alter table public.bot_members add column if not exists created_at timestamptz not null default now();

-- Medical-facilities bot: location is determined by having the member share
-- their phone number (Telegram request_contact button), which carries an
-- international dialing code we can map to a country — not from the
-- Telegram user id itself (owner decision 2026-08-29, question 7.1).
alter table public.bot_members add column if not exists phone_number text;
alter table public.bot_members add column if not exists country_code text;

-- ad-network bot: a real self-serve, two-sided task marketplace (owner
-- clarified 2026-08-29 that the earlier ad-campaign template — admin adds
-- ads manually — is NOT what they meant by "بوت الإعلانات"; that one is
-- kept as-is for a different future purpose). Advertisers create a task
-- (channel join / bot join / link visit) funded from their own points
-- balance; other members complete it to earn from that budget.
-- pending_action stores a short-lived "what are we waiting for from this
-- user next" marker (e.g. mid-way through creating a campaign) — this
-- project has no in-memory conversation state, so a DB column is the state.
alter table public.bot_members add column if not exists pending_action jsonb;

create table if not exists public.ad_tasks (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  advertiser_tg_user_id text not null,
  task_type text not null, -- channel_join | bot_join | link_visit
  target text not null, -- @channel, @bot, or a URL depending on task_type
  reward_points integer not null,
  slots_total integer not null,
  slots_remaining integer not null,
  status text not null default 'pending', -- pending | active | paused | exhausted | rejected
  created_at timestamptz not null default now()
);

create table if not exists public.ad_task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ad_tasks(id) on delete cascade,
  tg_user_id text not null,
  created_at timestamptz not null default now(),
  unique (task_id, tg_user_id)
);

-- Optional "join our channel" requirement on an ad: when set, /api/bots/ads/claim
-- verifies real Telegram channel membership via getChatMember before awarding
-- points, instead of trusting an honesty-based "I watched it" click.
alter table public.bot_ads add column if not exists channel_username text;

-- Store-bot expansion: dynamic products managed by the merchant via bot
-- commands (instead of only the fixed textarea entered once at bot creation),
-- plus a peer-to-peer used-item marketplace scoped to that bot's audience.
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  name text not null,
  price numeric,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  title text not null,
  price numeric,
  description text,
  status text not null default 'available', -- available | sold
  created_at timestamptz not null default now()
);

-- Medical-facilities system (pharmacy/hospital/clinic/medical point). One
-- unified table per facility_type instead of four near-identical tables
-- (see project brief section 10.2). Verification: license number + a photo
-- of the license (owner decision 2026-08-29, question 7.2) — the photo is
-- kept as a Telegram file_id (Telegram already hosts it for free) instead of
-- uploading to Supabase Storage, so there is zero extra storage cost; the
-- admin views it by fetching getFile with the bot's own token.
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations(id) on delete cascade,
  level text not null, -- governorate | city | district | village
  name text not null
);

-- Seed: Syria's 14 governorates as the top-level location entries the owner
-- explicitly used as the flagship example. Cities/districts/villages are
-- added incrementally later (by admin, or as real facilities register) —
-- not seeded here to avoid guessing an exhaustive, unverified city list.
insert into public.locations (level, name)
select 'governorate', g from (values
  ('دمشق'), ('ريف دمشق'), ('حلب'), ('حمص'), ('حماة'), ('اللاذقية'),
  ('طرطوس'), ('إدلب'), ('درعا'), ('السويداء'), ('القنيطرة'),
  ('دير الزور'), ('الرقة'), ('الحسكة')
) as t(g)
where not exists (
  select 1 from public.locations l where l.level = 'governorate' and l.name = t.g
);

create table if not exists public.medical_facilities (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  facility_type text not null, -- pharmacy | hospital | clinic | medical_point
  name text not null,
  governorate_id uuid references public.locations(id),
  city_text text, -- free text for now; upgrade to a locations row once a real city list exists
  owner_tg_user_id text not null,
  license_number text,
  license_photo_file_id text,
  verification_status text not null default 'pending', -- pending | verified | rejected
  created_at timestamptz not null default now()
);

create table if not exists public.facility_shifts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table if not exists public.facility_bookings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  tg_user_id text not null,
  requested_slot text not null,
  alternative_slot text,
  status text not null default 'pending', -- pending | approved | rejected | rescheduled
  created_at timestamptz not null default now()
);

alter table public.hosted_bots enable row level security;
alter table public.bot_members enable row level security;
alter table public.bot_wallet_tx enable row level security;
alter table public.bot_ads enable row level security;
alter table public.bot_appointments enable row level security;
alter table public.bot_ad_views enable row level security;
alter table public.store_products enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.locations enable row level security;
alter table public.medical_facilities enable row level security;
alter table public.facility_shifts enable row level security;
alter table public.facility_bookings enable row level security;
alter table public.ad_tasks enable row level security;
alter table public.ad_task_completions enable row level security;

-- Same lesson as earlier in this project: RLS alone does not grant access.
-- These tables were created via SQL Editor, so service_role (used by every
-- /api/bots/* route through supabaseAdmin()) needs an explicit GRANT — RLS
-- BYPASSRLS only skips policy checks, it does not skip base table privileges.
-- Root cause of "permission denied for table hosted_bots" in production.
grant select, insert, update, delete on
  public.hosted_bots, public.bot_members, public.bot_wallet_tx,
  public.bot_ads, public.bot_appointments, public.bot_ad_views,
  public.store_products, public.marketplace_listings,
  public.locations, public.medical_facilities, public.facility_shifts, public.facility_bookings,
  public.ad_tasks, public.ad_task_completions
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
