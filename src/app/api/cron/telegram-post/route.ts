import { NextRequest, NextResponse } from "next/server";
import { callGroq } from "@/lib/groq";

// Triggered daily by Vercel Cron (see vercel.json). Writes a fresh Arabic
// promotional post about the storefront's free tools / a rotating paid
// product, then publishes it directly to the public Telegram channel via
// the Bot API — genuine automated marketing, not a manual copy-paste task.
const SYSTEM_PROMPT = `أنت مسؤول تسويق لموقع "سوق تولز" (متجر أدوات وخدمات رقمية مصغّرة). اكتب منشوراً ترويجياً قصيراً وجذاباً بالعربية لقناة تليجرام (4-6 أسطر كحد أقصى، مع 2-3 إيموجي مناسبة، بدون هاشتاقات). كل مرة استخدم أسلوباً وزاوية مختلفة (نصيحة عملية، سؤال يثير الفضول، قصة نجاح مختصرة، عرض ميزة). اذكر رابط واحد فقط في نهاية المنشور. لا تكرر نفس الصياغة في كل مرة.`;

const TOPICS = [
  { name: "مولد رابط الطلب عبر واتساب (مجاني بالكامل)", url: "https://ttbik.vercel.app/free-tools/whatsapp-link" },
  { name: "مولد أسماء المشاريع بالذكاء الاصطناعي (مجاني)", url: "https://ttbik.vercel.app/free-tools/business-name-generator" },
  { name: "كتالوج واتساب الكامل لعرض كل منتجاتك", url: "https://ttbik.vercel.app/service/whatsapp-catalog" },
  { name: "محلل آراء العملاء بالجملة", url: "https://ttbik.vercel.app/service/review-analyzer" },
  { name: "بوت الرد الآلي الجاهز لتليجرام", url: "https://ttbik.vercel.app/service/auto-reply-bot" },
];

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

  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  let text: string;
  try {
    text = await callGroq(
      SYSTEM_PROMPT,
      `اكتب منشوراً عن: ${topic.name}. الرابط: ${topic.url}`,
      300
    );
  } catch {
    text = `🎁 جرّب ${topic.name} الآن مجاناً:\n${topic.url}`;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: channel, text }),
  });
  const data = await res.json();

  return NextResponse.json({ ok: data.ok === true, topic: topic.name });
}
