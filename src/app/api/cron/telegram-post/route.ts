import { NextRequest, NextResponse } from "next/server";
import { callGroq } from "@/lib/groq";
import { supabasePublic } from "@/lib/supabase";

// Triggered daily by Vercel Cron (see vercel.json). Publishes one varied
// promotional post to the public Telegram channel, rotating across three
// pools: free tools, live paid catalog services, and (only if configured)
// AD_BOT/MARRIAGE_BOT manual-purchase awareness posts.
//
// Paid services are fetched fresh from Supabase on every run instead of
// hardcoded — the old hardcoded list here had already drifted to include
// a retired service (whatsapp-catalog) and a dead one (review-analyzer)
// before the 2026-09-02 site audit caught it. Fetching live is what "دون
// اخطاء" (owner directive, 2026-09-03) actually requires: a service that
// gets deactivated tomorrow simply stops being eligible tomorrow, with no
// separate list to remember to update.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "");

const GENERIC_SYSTEM_PROMPT = `أنت مسؤول تسويق لموقع "سوق تولز" (متجر أدوات وخدمات رقمية مصغّرة). اكتب منشوراً ترويجياً قصيراً وجذاباً بالعربية لقناة تليجرام (4-6 أسطر كحد أقصى، مع 2-3 إيموجي مناسبة، بدون هاشتاقات). كل مرة استخدم أسلوباً وزاوية مختلفة (نصيحة عملية، سؤال يثير الفضول، قصة نجاح مختصرة، عرض ميزة). اذكر رابط واحد فقط في نهاية المنشور، بالضبط كما أعطيتك إياه دون أي تعديل عليه. لا تكرر نفس الصياغة في كل مرة.`;

// Static — mirrors src/app/free-tools/page.tsx's TOOLS + FREE_BOTS. Keep
// both lists in sync if a free tool/bot is added or removed there.
const FREE_TOPICS = [
  { name: "بطاقة أعمال رقمية (Linktree) مجانية مع عداد مشاهدات حقيقي", url: `${SITE_URL}/free-tools/digital-card` },
  { name: "مصغّر روابط مع عداد نقرات حقيقي (مجاني)", url: `${SITE_URL}/free-tools/url-shortener` },
  { name: "ضغط وتحويل الصور مجاناً داخل المتصفح، بلا رفع لأي خادم", url: `${SITE_URL}/free-tools/image-optimizer` },
  { name: "مولد رابط الطلب عبر واتساب (مجاني بالكامل)", url: `${SITE_URL}/free-tools/whatsapp-link` },
  { name: "مولد أسماء المشاريع بالذكاء الاصطناعي (مجاني)", url: `${SITE_URL}/free-tools/business-name-generator` },
  { name: "مساعد الكتابة الذكي: منشورات ومقالات وأوصاف منتجات وترجمة (مجاني)", url: `${SITE_URL}/free-tools/writing-assistant` },
  { name: "محلل النصوص الذكي: تلخيص تقارير وتحليل آراء عملاء (مجاني)", url: `${SITE_URL}/free-tools/text-analyzer` },
  { name: "بوت الرد الآلي الجاهز لتليجرام (مجاني، كود مصدري كامل تملكه)", url: `${SITE_URL}/service/auto-reply-bot` },
  { name: "بوت الأسئلة الشائعة الجاهز لتليجرام (مجاني، كود مصدري كامل تملكه)", url: `${SITE_URL}/service/faq-bot` },
];

async function getPaidTopics(): Promise<{ name: string; url: string }[]> {
  try {
    const db = supabasePublic();
    const { data } = await db.from("services").select("slug, name_ar").eq("is_active", true).gt("price_usd", 0);
    return (data ?? []).map((s: any) => ({ name: s.name_ar as string, url: `${SITE_URL}/service/${s.slug}` }));
  } catch {
    return [];
  }
}

type BotPromo = { label: string; intro: string; price: string; botLink: string; cta: string };

// AD_BOT/MARRIAGE_BOT are never sold or self-served on the website — manual
// price/payment/approval only (docs/AGENT_BUS.md Product rules, owner
// directive 2026-09-03). Offered here purely as awareness, and only once
// the owner has set the right username(s); silently skipped otherwise so
// this route never errors or posts a link that doesn't exist.
//
// The two templates route "I want to buy one" completely differently —
// this is NOT the channel's own posting bot (TELEGRAM_BOT_TOKEN, which
// just sends this cron's messages and runs no AD_BOT/MARRIAGE_BOT
// template logic at all):
// - AD_BOT already has a self-serve purchase flow built into every AD_BOT
//   instance (src/lib/adBotLogic.ts's "أريد بوتاً مماثلاً" button → $100
//   bank-transfer flow → owner's manual approval). PROMO_AD_BOT_USERNAME
//   must be the @username of an AD_BOT-template bot the owner already has
//   running (e.g. their own admin/management instance) — the promo post
//   just points there and tells people to tap that button; no separate
//   contact link needed.
// - MARRIAGE_BOT has no such in-bot flow (src/lib/matchBotLogic.ts never
//   offers it) — a MARRIAGE_BOT promo therefore ALSO needs
//   ADMIN_CONTACT_USERNAME (the owner's own personal Telegram username) as
//   the only way to actually reach someone about it, so both must be set
//   together or this promo type is skipped.
function getBotPromos(): BotPromo[] {
  const promos: BotPromo[] = [];
  if (process.env.PROMO_AD_BOT_USERNAME) {
    promos.push({
      label: "بوت الإعلانات والمهام",
      intro: "📢 عندك قناة أو مجموعة على تليجرام؟ فعّل بوت إعلانات ومهام خاصاً بك يوزّع أرباح المشاهدة تلقائياً بين المستخدمين والمنصة.",
      price: "100$ (تحويل بنكي)",
      botLink: `https://t.me/${process.env.PROMO_AD_BOT_USERNAME}`,
      cta: "التفعيل يتم يدوياً فقط: افتح البوت واضغط زر «أريد بوتاً مماثلاً» من القائمة، ثم اتبع الخطوات — لا تفعيل تلقائي ولا كود مجاني.",
    });
  }
  if (process.env.PROMO_MARRIAGE_BOT_USERNAME && process.env.ADMIN_CONTACT_USERNAME) {
    promos.push({
      label: "بوت التعارف والزواج الشرعي",
      intro: "💍 منصة تعارف وزواج شرعي كاملة، كبوت تليجرام خاص بك تديره بنفسك.",
      price: "حسب الاتفاق مع الإدارة",
      botLink: `https://t.me/${process.env.PROMO_MARRIAGE_BOT_USERNAME}`,
      cta: `هذا القالب لا يُفعَّل من داخل البوت — للشراء والتفاصيل تواصل مباشرة: https://t.me/${process.env.ADMIN_CONTACT_USERNAME}`,
    });
  }
  return promos;
}

async function writeGenericPost(topic: { name: string; url: string }): Promise<string> {
  try {
    return await callGroq(GENERIC_SYSTEM_PROMPT, `اكتب منشوراً عن: ${topic.name}. الرابط: ${topic.url}`, 300);
  } catch {
    return `🎁 جرّب ${topic.name} الآن:\n${topic.url}`;
  }
}

// Price and the CTA (bot button vs. personal contact — see getBotPromos)
// are fixed here, never left to the AI — a wrong price or a broken/missing
// link in a public channel post is the one mistake this route must never
// make. Groq only writes the opening hook line; if it fails, the default
// intro line is used instead.
async function buildBotPromoText(promo: BotPromo): Promise<string> {
  let hook = promo.intro;
  try {
    hook = await callGroq(
      `اكتب سطراً أو سطرين ترويجيين جذابين بالعربية (بدون رابط، بدون ذكر سعر) عن هذا المنتج، بنفس روح المثال التالي دون نسخه حرفياً: "${promo.intro}"`,
      promo.label,
      120
    );
  } catch {
    // keep default intro
  }
  return `${hook}\n\n🔗 هنا: ${promo.botLink}\n💰 السعر: ${promo.price}\n${promo.cta}`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const isAuthorized =
    auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET;
  if (!isAuthorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) {
    return NextResponse.json({ error: "Telegram not configured" }, { status: 503 });
  }

  const paidTopics = await getPaidTopics();
  const botPromos = getBotPromos();

  // Plain topics (free + live paid) far outnumber bot-purchase pitches, so
  // AD_BOT/MARRIAGE_BOT awareness posts stay an occasional post, not a spam
  // pattern — roughly 1-in-N where N grows with the live catalog size.
  const pool: { label: string; run: () => Promise<string> }[] = [
    ...FREE_TOPICS.map((t) => ({ label: t.name, run: () => writeGenericPost(t) })),
    ...paidTopics.map((t) => ({ label: t.name, run: () => writeGenericPost(t) })),
    ...botPromos.map((p) => ({ label: p.label, run: () => buildBotPromoText(p) })),
  ];

  const picked = pool[Math.floor(Math.random() * pool.length)];
  const text = await picked.run();

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: channel, text }),
  });
  const data = await res.json();

  return NextResponse.json({ ok: data.ok === true, topic: picked.label });
}
