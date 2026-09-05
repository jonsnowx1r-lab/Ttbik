import { Bot as TelegramBot } from "grammy";
import type { Bot as BotRow } from "@prisma/client";

// NOVA_BOT — the owner's $0-cost general AI assistant product (owner
// spec, 2026-09-05). Deliberately different in kind from every other
// template in this file's sibling modules: this one is a genuine
// general-purpose AI chat product with paid subscriptions, which is
// exactly what src/lib/groq.ts's SITE_IDENTITY_PROMPT comment says this
// site is NOT ("ليس متجراً يبيع وصولاً عاماً لذكاء اصطناعي كمنتج قائم
// بذاته") — that constraint was scoped to the narrow single-purpose
// free tools (writing assistant, text analyzer), not a blanket ban;
// the owner explicitly and repeatedly asked for this broader product
// across several confirmed rounds, so it's a deliberate exception, not
// an oversight. Flagged in docs/agent-state.json for visibility.
//
// This file is intentionally a THIN CLIENT: it owns zero AI logic and
// zero user/quota state — both live in the separate Python FastAPI
// service under ai-system/ (see ai-system/app/main.py), which talks to
// the same Supabase project directly via the NovaUser/NovaUsageLog/
// NovaSubscription tables (prisma/migration_19_nova_ai.sql). All this
// file does is forward each Telegram message over HTTP and relay the
// answer — the Streamlit web UI and any external API caller hit the
// exact same endpoint, so behavior never drifts between channels.
//
// Same private, owner-only deploy gate as MARRIAGE_BOT/JOBS_BOT/
// MEDICAL_BOT (NOVA_BOT_CREATOR_PASSWORD) — the owner deploys their own
// single instance, then real end-users interact with THAT bot and pay
// for higher quota via /subscribe, same commercial shape as AD_BOT
// already has today (owner deploys once, many external users use it).

const FASTAPI_URL = process.env.NOVA_FASTAPI_URL || "";
const INTERNAL_SECRET = process.env.NOVA_INTERNAL_SECRET || "";

// The model council writes plain Markdown (**bold**, # headers, etc.),
// but Telegram's own Markdown/MarkdownV2 parse modes require every
// special character to be perfectly escaped — a single stray one from
// model output throws and the message never arrives at all. Stripping
// the common markers to plain text is less pretty but never fails.
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
}

async function callNovaBackend(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  if (!FASTAPI_URL || !INTERNAL_SECRET) {
    return { ok: false, data: { detail: "NOVA_FASTAPI_URL / NOVA_INTERNAL_SECRET غير مُعدّين على Vercel." } };
  }
  try {
    const res = await fetch(`${FASTAPI_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
      body: JSON.stringify(body),
      // Render's free instance type spins down after ~15 minutes idle and
      // takes 30-50s to wake on the next request — a 25s timeout was
      // aborting the very first message after any idle gap, every time.
      // Matches maxDuration=60 on the telegram route below.
      signal: AbortSignal.timeout(55000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { detail: "تعذر الاتصال بخادم Nova AI حالياً — حاول لاحقاً." } };
  }
}

export async function handleNovaBotUpdate(bot: TelegramBot, _botRow: BotRow, update: any) {
  const msg = update.message;
  if (!msg?.text || !msg.chat?.id) return;

  const chatId = msg.chat.id;
  const tgUserId = String(msg.from.id);
  const text = String(msg.text).trim();

  if (text === "/start") {
    await bot.api.sendMessage(
      chatId,
      "✨ أهلاً بك في Nova AI — مساعدك الذكي المجاني.\nاكتب أي سؤال مباشرة، وسأجيبك مستعيناً بعدة نماذج ذكاء اصطناعي معاً.\nأرسل /ترقية في أي وقت لرفع حدك اليومي."
    );
    return;
  }

  if (text === "/ترقية" || text === "/subscribe") {
    const { ok, data } = await callNovaBackend("/subscribe", { channel: "TELEGRAM", telegram_id: tgUserId });
    await bot.api.sendMessage(chatId, ok ? data.message : `تعذر إرسال الطلب: ${data.detail || "خطأ غير معروف"}`);
    return;
  }

  await bot.api.sendChatAction(chatId, "typing").catch(() => null);

  const { ok, data } = await callNovaBackend("/chat", { channel: "TELEGRAM", telegram_id: tgUserId, message: text });
  if (!ok) {
    await bot.api.sendMessage(chatId, data?.detail || "حدث خطأ — حاول مرة أخرى بعد قليل.");
    return;
  }

  await bot.api.sendMessage(chatId, stripMarkdown(data.answer));
}
