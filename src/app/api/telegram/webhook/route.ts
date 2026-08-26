import { NextRequest, NextResponse } from "next/server";
import { decideOrder } from "@/lib/orders";
import { answerCallbackQuery } from "@/lib/telegram";

/**
 * Telegram webhook endpoint. Set it once via:
 * https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SITE_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const callback = update?.callback_query;
  if (!callback) return NextResponse.json({ ok: true }); // ignore non-callback updates

  const [action, orderId] = String(callback.data || "").split(":");
  if (!orderId || !["approve", "reject"].includes(action)) {
    await answerCallbackQuery(callback.id, "أمر غير معروف");
    return NextResponse.json({ ok: true });
  }

  try {
    await decideOrder(orderId, action === "approve" ? "approved" : "rejected");
    await answerCallbackQuery(callback.id, action === "approve" ? "تمت الموافقة ✅" : "تم الرفض ❌");
  } catch {
    await answerCallbackQuery(callback.id, "تعذّر تنفيذ الإجراء");
  }

  return NextResponse.json({ ok: true });
}
