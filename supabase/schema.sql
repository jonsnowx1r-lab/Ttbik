-- ============================================================================
-- TTBIK Marketplace — Supabase SQL Schema
-- Free-tier Postgres (Supabase). Run this once in the SQL editor of your
-- Supabase project (Project → SQL Editor → New query → paste → Run).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- categories: the storefront sections (أقسام)
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name_ar     text not null,
  name_en     text,
  description_ar text,
  icon        text default '🧩',
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- services: individual sellable micro-services / templates / bots
-- demo_type drives which interactive component renders on the service page
-- delivery_type/content: what the customer receives automatically on approval
-- ---------------------------------------------------------------------------
create table if not exists services (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid references categories(id) on delete cascade,
  slug              text unique not null,
  name_ar           text not null,
  name_en           text,
  short_desc_ar     text,
  long_desc_ar      text,
  price_usd         numeric(10,2) not null default 0,
  demo_type         text not null check (demo_type in ('ai_chat','bot_simulator','landing_builder','content_ai')),
  delivery_type     text not null default 'text' check (delivery_type in ('link','text')),
  delivery_content  text, -- e.g. GitHub repo link, license key, Notion guide link
  is_active         boolean default true,
  sort_order        int default 0,
  created_at        timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- customers: light-weight, created on first order (no auth required)
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text not null, -- telegram username / email / phone
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- orders: one row per purchase attempt
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  order_code          text unique not null,
  service_id          uuid references services(id) on delete restrict,
  customer_id         uuid references customers(id) on delete set null,
  customer_name       text not null,
  customer_contact    text not null,
  payment_method      text not null check (payment_method in ('iban','usdt')),
  transfer_reference  text not null, -- اسم المُحوِّل / رقم العملية
  amount_usd          numeric(10,2) not null,
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  delivery_content    text, -- filled automatically (or overridden by admin) on approval
  admin_note          text,
  telegram_chat_id    text,
  telegram_message_id text,
  created_at          timestamptz default now(),
  decided_at          timestamptz
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_code on orders(order_code);

-- ---------------------------------------------------------------------------
-- notifications: in-site notification log (alternative to Telegram)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete cascade,
  channel     text not null default 'site' check (channel in ('site','telegram')),
  message     text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================================
-- Row Level Security
-- Public (anon key) may: read active services/categories, create an order,
-- and read the status of ONE order by its order_code (used by the tracking
-- page). Everything else (admin dashboard, approve/reject) uses the
-- SUPABASE_SERVICE_ROLE_KEY from server-side code only, which bypasses RLS.
-- ============================================================================

alter table categories enable row level security;
alter table services enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table notifications enable row level security;

create policy "public read categories" on categories
  for select using (true);

create policy "public read active services" on services
  for select using (is_active = true);

create policy "public can create customer" on customers
  for insert with check (true);

create policy "public can create order" on orders
  for insert with check (status = 'pending');

-- No public SELECT policy on orders: the table holds customer PII (name,
-- contact, transfer reference), so it must never be readable directly via
-- the anon key/PostgREST. Order tracking instead goes through the narrow,
-- security-definer function below, which returns only non-sensitive columns
-- for a single order_code at a time.

-- notifications and customer/order updates are admin-only (service role),
-- so no additional policies are added for them (default deny).

create or replace function get_order_public_status(p_order_code text)
returns table (
  order_code text,
  status text,
  amount_usd numeric,
  service_name text,
  delivery_type text,
  delivery_content text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.order_code,
    o.status,
    o.amount_usd,
    s.name_ar as service_name,
    s.delivery_type,
    case when o.status = 'approved' then o.delivery_content else null end as delivery_content,
    o.created_at
  from orders o
  join services s on s.id = o.service_id
  where o.order_code = p_order_code
  limit 1;
$$;

revoke all on function get_order_public_status(text) from public;
grant execute on function get_order_public_status(text) to anon, authenticated;

-- ============================================================================
-- Seed data — 4 free-to-run categories, ~3 services each
-- ============================================================================

insert into categories (slug, name_ar, name_en, description_ar, icon, sort_order) values
  ('telegram-bots', 'بوتات تليجرام', 'Telegram Bots', 'بوتات جاهزة تعمل مجاناً على Telegram Bot API لأتمتة الردود وإدارة الطلبات.', '🤖', 1),
  ('ai-translation', 'الترجمة والذكاء الاصطناعي', 'AI & Translation', 'أدوات نصية ذكية تعمل بنماذج Groq المجانية: ترجمة، تلخيص، ردود آلية.', '🌐', 2),
  ('automation-sites', 'الأتمتة والمواقع', 'Automation & Sites', 'قوالب مواقع وسكربتات أتمتة جاهزة للتشغيل الفوري بدون تكلفة استضافة.', '⚙️', 3),
  ('content-design', 'المحتوى والتصميم بالذكاء الاصطناعي', 'AI Content', 'كتابة محتوى تسويقي، أوصاف منتجات، ومنشورات سوشيال ميديا بالذكاء الاصطناعي.', '🎨', 4)
on conflict (slug) do nothing;

insert into services (category_id, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
select c.id, s.slug, s.name_ar, s.short_desc_ar, s.long_desc_ar, s.price_usd, s.demo_type, s.delivery_type, s.delivery_content, s.sort_order
from (values
  ('telegram-bots', 'auto-reply-bot', 'بوت الرد الآلي', 'بوت تليجرام يرد تلقائياً على استفسارات عملائك على مدار الساعة.',
    'كود جاهز (Node.js) لبوت رد آلي مبني على Telegram Bot API المجاني، يدعم كلمات مفتاحية وردود مخصصة وقوائم أزرار. يعمل مجاناً على أي استضافة Free Tier.',
    7, 'bot_simulator', 'link', 'https://github.com/your-org/auto-reply-bot-template', 1),
  ('telegram-bots', 'order-manager-bot', 'بوت إدارة الطلبات', 'بوت لاستقبال طلبات العملاء والموافقة عليها بضغطة زر، بنفس فكرة هذه المنصة.',
    'نسخة مصغرة وقابلة لإعادة الاستخدام من نظام الطلبات في هذه المنصة نفسها: استقبال طلب، إشعار فوري، أزرار موافقة/رفض.',
    15, 'bot_simulator', 'link', 'https://github.com/your-org/order-manager-bot-template', 2),
  ('telegram-bots', 'faq-bot', 'بوت الأسئلة الشائعة', 'بوت يجيب تلقائياً على الأسئلة المتكررة لعملائك من قائمة تجهزها أنت.',
    'يقرأ قائمة أسئلة/أجوبة من ملف JSON بسيط ويجيب فوراً دون أي تدخل بشري.',
    5, 'bot_simulator', 'link', 'https://github.com/your-org/faq-bot-template', 3)
) as s(cat_slug, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
join categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;

insert into services (category_id, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
select c.id, s.slug, s.name_ar, s.short_desc_ar, s.long_desc_ar, s.price_usd, s.demo_type, s.delivery_type, s.delivery_content, s.sort_order
from (values
  ('ai-translation', 'smart-translator', 'المترجم الذكي', 'ترجمة فورية بين العربية وأكثر من 20 لغة باستخدام الذكاء الاصطناعي.',
    'أداة ترجمة تعمل بنموذج Groq المجاني (Llama 3)، أسرع وأدق من الترجمة الحرفية التقليدية في السياقات التجارية.',
    3, 'ai_chat', 'link', 'https://your-app.vercel.app/tools/translator?license=FULL', 1),
  ('ai-translation', 'text-summarizer', 'تلخيص النصوص', 'حوّل أي مقال أو تقرير طويل إلى ملخص من 5 أسطر خلال ثوانٍ.',
    'مفيد للطلاب والموظفين لتلخيص المستندات والتقارير بسرعة.',
    4, 'ai_chat', 'link', 'https://your-app.vercel.app/tools/summarizer?license=FULL', 2),
  ('ai-translation', 'ai-chat-assistant', 'مساعد ذكي للرد على العملاء', 'مساعد محادثة ذكي يمكن تضمينه في موقعك للرد على استفسارات العملاء.',
    'ودجت جاهز للتضمين (Embed) في أي موقع، مبني على Groq API المجاني.',
    10, 'ai_chat', 'link', 'https://github.com/your-org/ai-chat-widget-template', 3)
) as s(cat_slug, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
join categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;

insert into services (category_id, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
select c.id, s.slug, s.name_ar, s.short_desc_ar, s.long_desc_ar, s.price_usd, s.demo_type, s.delivery_type, s.delivery_content, s.sort_order
from (values
  ('automation-sites', 'landing-page-generator', 'منشئ صفحات الهبوط', 'أنشئ صفحة هبوط احترافية لمشروعك خلال دقائق بدون كتابة كود.',
    'قالب Next.js جاهز للنشر المجاني على Vercel، يتيح تغيير النصوص والألوان والشعار بسهولة.',
    12, 'landing_builder', 'link', 'https://github.com/your-org/landing-page-template', 1),
  ('automation-sites', 'workflow-templates', 'قوالب أتمتة جاهزة', 'بديل مجاني لأدوات مثل Zapier: قوالب أتمتة جاهزة تعمل بخدمات مجانية.',
    'مجموعة سيناريوهات أتمتة (مثل: ربط نموذج الموقع بجدول Google Sheets وتنبيه Telegram) دون أي اشتراك مدفوع.',
    9, 'landing_builder', 'link', 'https://github.com/your-org/free-automation-recipes', 2),
  ('automation-sites', 'invoice-generator', 'مولد الفواتير التلقائي', 'أداة تنشئ فواتير PDF احترافية لعملائك تلقائياً.',
    'يعمل بالكامل على المتصفح (Client-side) دون أي سيرفر أو تكلفة تشغيل.',
    6, 'landing_builder', 'link', 'https://github.com/your-org/invoice-generator-template', 3)
) as s(cat_slug, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
join categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;

insert into services (category_id, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
select c.id, s.slug, s.name_ar, s.short_desc_ar, s.long_desc_ar, s.price_usd, s.demo_type, s.delivery_type, s.delivery_content, s.sort_order
from (values
  ('content-design', 'social-caption-generator', 'مولد منشورات السوشيال ميديا', 'اكتب منشورات جذابة لإنستغرام وتيك توك وتويتر خلال ثوانٍ.',
    'أداة تولّد نصوص منشورات بأساليب متعددة (مرح، احترافي، تسويقي) بالذكاء الاصطناعي المجاني.',
    3, 'content_ai', 'link', 'https://your-app.vercel.app/tools/captions?license=FULL', 1),
  ('content-design', 'blog-writer', 'كاتب المقالات الآلي', 'اكتب مسودة مقال متكامل بالعنوان والمقدمة والفقرات من كلمة مفتاحية واحدة.',
    'يوفر ساعات من الكتابة اليدوية، ويصلح كنقطة بداية لمقالات SEO.',
    8, 'content_ai', 'link', 'https://your-app.vercel.app/tools/blog-writer?license=FULL', 2),
  ('content-design', 'product-description-writer', 'كاتب أوصاف المنتجات', 'أوصاف منتجات مقنعة لمتجرك الإلكتروني خلال ثوانٍ.',
    'مثالي لأصحاب متاجر Shopify/Salla الذين يحتاجون أوصاف منتجات بكميات كبيرة.',
    5, 'content_ai', 'link', 'https://your-app.vercel.app/tools/product-desc?license=FULL', 3)
) as s(cat_slug, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, sort_order)
join categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;
