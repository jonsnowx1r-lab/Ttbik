// Free Telegram FAQ bot — answers customer questions from a simple JSON
// list using keyword-overlap matching (no paid NLP APIs, no dependencies).

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable. Get one for free from @BotFather.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const faq = JSON.parse(fs.readFileSync(path.join(__dirname, "faq.json"), "utf8"));
const FALLBACK = "لم أفهم سؤالك تماماً، سيتم تحويله لفريق الدعم البشري.";

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function bestMatch(userText) {
  const userWords = new Set(tokenize(userText));
  let best = null;
  let bestScore = 0;

  for (const entry of faq) {
    const questionWords = tokenize(entry.question);
    const overlap = questionWords.filter((w) => userWords.has(w)).length;
    const score = overlap / questionWords.length;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 0.4 ? best : null;
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
      const match = bestMatch(message.text);
      await sendMessage(message.chat.id, match ? match.answer : FALLBACK);
    }
  }
  return nextOffset;
}

async function main() {
  console.log("FAQ bot running (long polling)...");
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
