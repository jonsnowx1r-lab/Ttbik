-- =============================================================================
-- سكربت التفعيل المجمّع للقاعدة الحية (Supabase SQL Editor)
-- ---------------------------------------------------------------------------
-- بدل تشغيل سكربت جديد كل مرة نضيف قسماً/أداة/فكرة، كل التغييرات المطلوبة على
-- القاعدة الحية تُجمَع هنا وتُشغَّل دفعة واحدة لاحقاً. آمن لإعادة التشغيل
-- (idempotent) — كل سطر يستخدم if not exists / on conflict do nothing.
-- =============================================================================

-- 1) عمود subcategory + قيد demo_type المحدّث (يشمل ad_slot_preview و studio_tool)
alter table services add column if not exists subcategory text;

alter table services drop constraint if exists services_demo_type_check;
alter table services add constraint services_demo_type_check
  check (demo_type in ('ai_chat','bot_simulator','landing_builder','content_ai','catalog_builder','ad_slot_preview','studio_tool'));

-- 2) تصنيف فرعي لبوتات تليجرام الحالية
update services set subcategory = 'الرد والدعم' where slug in ('auto-reply-bot', 'faq-bot');
update services set subcategory = 'الإدارة والطلبات' where slug = 'order-manager-bot';

-- 3) بوت بيع المساحات الإعلانية + "أعلن في قناتنا"
insert into services (category_id, slug, name_ar, subcategory, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, tool_route, sort_order)
select id, 'ad-slot-bot', 'بوت بيع المساحات الإعلانية', 'الإعلانات والتسويق',
  'بوت جاهز يبيع مساحات إعلانية في قناتك بنظام رصيد مسبق الدفع، آمن وبدون سحب أموال حقيقي.',
  'كود جاهز (Node.js): العميل يشتري رصيداً إعلانياً، يرسل نص إعلانه، أنت توافق بضغطة زر، والبوت ينشره بنفسه. نظام رصيد وليس محفظة إيداع/سحب حقيقية.',
  18, 'ad_slot_preview', 'link', 'https://github.com/jonsnowx1r-lab/Ttbik/tree/main/templates/ad-slot-bot', null, 4
from categories where slug = 'telegram-bots'
on conflict (slug) do nothing;

insert into services (category_id, slug, name_ar, subcategory, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, tool_route, sort_order)
select id, 'channel-ad-slot', 'أعلن في قناتنا', 'الإعلانات والتسويق',
  'اعرض إعلان مشروعك على مشتركي قناة سوق تولز على تليجرام.',
  'نشر إعلانك في قناة @ttbik5 خلال 24 ساعة من الموافقة. أرسل نص إعلانك ورابطك عبر وسيلة التواصل التي تزوّدنا بها عند الطلب.',
  8, 'ad_slot_preview', 'text', 'شكراً لطلبك! أرسل نص إعلانك ورابطك عبر وسيلة التواصل التي زوّدتنا بها، وسنقوم بنشره في القناة خلال 24 ساعة.', null, 5
from categories where slug = 'telegram-bots'
on conflict (slug) do nothing;

-- 4) قسم "أدوات إبداعية مبتكرة" + استوديو تحويل الصوت إلى فيديو ريلز
insert into categories (slug, name_ar, name_en, description_ar, icon, sort_order) values
  ('creative-studio', 'أدوات إبداعية مبتكرة', 'Creative Studio', 'أدوات حقيقية ونادرة تعمل بالكامل داخل متصفحك — لا تجدها بسهولة في أي مكان آخر.', '🎬', 5)
on conflict (slug) do nothing;

insert into services (category_id, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, tool_route, sort_order)
select c.id, s.slug, s.name_ar, s.short_desc_ar, s.long_desc_ar, s.price_usd, s.demo_type, s.delivery_type, s.delivery_content, s.tool_route, s.sort_order
from (values
  ('creative-studio', 'audio-visualizer', 'استوديو تحويل الصوت إلى فيديو ريلز',
    'حوّل أي مقطع صوتي إلى فيديو عمودي 9:16 بموجات صوتية متحركة، جاهز للنشر على TikTok وInstagram Reels خلال ثوانٍ.',
    'أداة حقيقية تعمل بالكامل داخل متصفحك عبر Web Audio API وCanvas وMediaRecorder — بدون رفع ملفاتك لأي خادم. ارفع الصوت وصورة غلاف اختيارية ونصاً، واحصل على فيديو WebM جاهز للنشر فوراً.',
    12, 'studio_tool', 'link', null, 'audio-visualizer', 1)
) as s(cat_slug, slug, name_ar, short_desc_ar, long_desc_ar, price_usd, demo_type, delivery_type, delivery_content, tool_route, sort_order)
join categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;

-- =============================================================================
-- كل إضافة جديدة (قسم/أداة/فكرة) تُلحَق كسطر/كتلة جديدة في نهاية هذا الملف،
-- ولا يُطلب من المالك تشغيل أي شيء حتى موعد التنفيذ المجمّع.
-- =============================================================================
