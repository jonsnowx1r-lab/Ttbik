// Free Telegram auto-reply bot — no paid dependencies, uses Node's built-in
// fetch (Node 18+) and Telegram's long-polling getUpdates, so it needs no
// public URL/webhook and can run on any free-tier always-on host
// (e.g. Railway/Render free tier, or a Raspberry Pi / always-on PC).

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable. Get one for free from @BotFather.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const replies = JSON.parse(fs.readFileSync(path.join(__dirname, "replies.json"), "utf8"));

function pickReply(text) {
  const lower = (text || "").toLowerCase();
  for (const rule of replies.rules) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) return rule.reply;
  }
  return replies.default;
}

async function sendMessage(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function poll(offset) {
  const res = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
  const data = await res.json();
  let nextOffset = offset;

  for (const update of data.result || []) {
    nextOffset = update.update_id + 1;
    const message = update.message;
    if (message?.text) {
      const reply = pickReply(message.text);
      await sendMessage(message.chat.id, reply);
      console.log(`Replied to ${message.chat.id}: "${message.text}" -> "${reply}"`);
    }
  }
  return nextOffset;
}

async function main() {
  console.log("Auto-reply bot running (long polling)...");
  let offset = 0;
  for (;;) {
    try {
      offset = await poll(offset);
    } catch (err) {
      console.error("Poll error:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
