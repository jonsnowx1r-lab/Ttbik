// Google Apps Script — sends a Telegram alert every time your linked
// Google Form receives a new response. 100% free (Google account only).

const TELEGRAM_BOT_TOKEN = "PASTE_YOUR_BOT_TOKEN_HERE";
const TELEGRAM_CHAT_ID = "PASTE_YOUR_CHAT_ID_HERE";

function onFormSubmit(e) {
  const values = e.namedValues; // { "Question label": ["answer"], ... }
  const lines = Object.keys(values).map((q) => `${q}: ${values[q].join(", ")}`);
  const text = "📝 استجابة جديدة على النموذج:\n" + lines.join("\n");

  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
}
