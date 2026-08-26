// Ad-Slot Bot — sells advertising space in your Telegram channel(s) using a
// prepaid CREDIT system, not a real deposit/withdrawal wallet.
//
// Why credit and not real deposit/withdraw: a bot that lets strangers
// deposit and withdraw real money is functionally an unlicensed e-wallet in
// most jurisdictions, and is exactly the pattern used by the many scam
// "ad bots" on Telegram that never pay out. Selling prepaid ad credit
// (like buying a gift card) avoids both problems — you take payment
// yourself (bank/USDT, manually, same as everywhere else in this project)
// and top up the buyer's credit; there is nothing to "withdraw".
//
// Flow:
//   1. Buyer pays you (out-of-band, e.g. via the same bank/USDT flow as
//      your storefront) for ad credit.
//   2. You run: node index.js and use /credit <user_id> <amount> to top
//      up their balance.
//   3. Buyer sends /ad <text> to the bot. If they have enough credit, the
//      ad goes to you (the admin) for approval with inline buttons.
//   4. You approve → the bot deducts the credit and posts the ad to every
//      channel configured in CHANNELS, then tells the buyer it's live.

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const CHANNELS = (process.env.AD_CHANNELS || "").split(",").map((c) => c.trim()).filter(Boolean);
const AD_COST = Number(process.env.AD_COST || 5); // credit units consumed per approved ad

if (!TOKEN || !ADMIN_CHAT_ID || CHANNELS.length === 0) {
  console.error(
    "Missing TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, or AD_CHANNELS (comma-separated, e.g. @mychannel)."
  );
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const CREDITS_FILE = path.join(__dirname, "credits.json");
const ADS_FILE = path.join(__dirname, "ads.json");

function loadJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function getBalance(credits, userId) {
  return credits[userId]?.balance || 0;
}

async function handleMessage(message, credits, ads) {
  const userId = String(message.from.id);
  const text = (message.text || "").trim();

  if (text === "/start" || text === "/help") {
    return tg("sendMessage", {
      chat_id: message.chat.id,
      text: `مرحباً! أرسل /balance لمعرفة رصيدك، أو /ad <نص إعلانك> لطلب نشر إعلان (تكلفة كل إعلان: ${AD_COST} نقطة).`,
    });
  }

  if (text === "/balance") {
    return tg("sendMessage", {
      chat_id: message.chat.id,
      text: `رصيدك الحالي: ${getBalance(credits, userId)} نقطة.`,
    });
  }

  // Admin-only: top up a user's credit after receiving payment out-of-band.
  if (text.startsWith("/credit ") && userId === String(ADMIN_CHAT_ID)) {
    const [, targetId, amountStr] = text.split(" ");
    const amount = Number(amountStr);
    if (!targetId || !amount) {
      return tg("sendMessage", { chat_id: message.chat.id, text: "الصيغة: /credit <user_id> <amount>" });
    }
    credits[targetId] = credits[targetId] || { balance: 0 };
    credits[targetId].balance += amount;
    saveJson(CREDITS_FILE, credits);
    return tg("sendMessage", {
      chat_id: message.chat.id,
      text: `تم إضافة ${amount} نقطة للمستخدم ${targetId}. رصيده الآن: ${credits[targetId].balance}.`,
    });
  }

  if (text.startsWith("/ad ")) {
    const adText = text.slice(4).trim();
    if (!adText) return tg("sendMessage", { chat_id: message.chat.id, text: "أرسل النص بعد /ad" });

    if (getBalance(credits, userId) < AD_COST) {
      return tg("sendMessage", {
        chat_id: message.chat.id,
        text: `رصيدك غير كافٍ (تحتاج ${AD_COST} نقطة). تواصل مع الإدارة لشراء رصيد إعلاني.`,
      });
    }

    const adId = Date.now();
    ads.push({ id: adId, userId, chatId: message.chat.id, text: adText, status: "pending" });
    saveJson(ADS_FILE, ads);

    await tg("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: `📢 طلب إعلان جديد #${adId} من ${userId}:\n\n${adText}`,
      reply_markup: {
        inline_keyboard: [[
          { text: "نشر ✅", callback_data: `approve:${adId}` },
          { text: "رفض ❌", callback_data: `reject:${adId}` },
        ]],
      },
    });
    return tg("sendMessage", { chat_id: message.chat.id, text: "تم إرسال إعلانك للمراجعة." });
  }
}

async function handleCallback(cb, ads, credits) {
  const [action, idStr] = String(cb.data || "").split(":");
  const id = Number(idStr);
  const ad = ads.find((a) => a.id === id);
  if (!ad || ad.status !== "pending") {
    return tg("answerCallbackQuery", { callback_query_id: cb.id, text: "تم التعامل مع هذا الطلب مسبقاً" });
  }

  if (action === "approve") {
    ad.status = "approved";
    credits[ad.userId] = credits[ad.userId] || { balance: 0 };
    credits[ad.userId].balance -= AD_COST;
    saveJson(CREDITS_FILE, credits);
    saveJson(ADS_FILE, ads);

    for (const channel of CHANNELS) {
      await tg("sendMessage", { chat_id: channel, text: ad.text });
    }
    await tg("sendMessage", { chat_id: ad.chatId, text: "✅ تم نشر إعلانك في القناة." });
    await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "تم النشر" });
  } else if (action === "reject") {
    ad.status = "rejected";
    saveJson(ADS_FILE, ads);
    await tg("sendMessage", { chat_id: ad.chatId, text: "❌ تم رفض إعلانك، لم يُخصم أي رصيد." });
    await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "تم الرفض" });
  }
}

async function main() {
  console.log("Ad-slot bot running (long polling)...");
  let offset = 0;
  for (;;) {
    try {
      const res = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
      const data = await res.json();
      const credits = loadJson(CREDITS_FILE, {});
      const ads = loadJson(ADS_FILE, []);

      for (const update of data.result || []) {
        offset = update.update_id + 1;
        if (update.message) await handleMessage(update.message, credits, ads);
        if (update.callback_query) await handleCallback(update.callback_query, ads, credits);
      }
    } catch (err) {
      console.error("Poll error:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
