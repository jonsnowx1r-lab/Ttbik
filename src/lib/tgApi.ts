const TG_API = "https://api.telegram.org";

export async function tgCall<T = any>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({ ok: false, description: "telegram_parse_error" }));
}

export async function tgGetMe(token: string) {
  return tgCall<{ id: number; username?: string; first_name: string }>(token, "getMe");
}

export async function tgSetWebhook(token: string, url: string, secret: string) {
  return tgCall(token, "setWebhook", {
    url,
    secret_token: secret,
    drop_pending_updates: false,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function tgDeleteWebhook(token: string) {
  return tgCall(token, "deleteWebhook", { drop_pending_updates: false });
}

export async function tgSend(
  token: string,
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {}
) {
  return tgCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    ...extra,
  });
}

export async function tgAnswerCallback(token: string, id: string, text?: string) {
  return tgCall(token, "answerCallbackQuery", {
    callback_query_id: id,
    text,
    show_alert: false,
  });
}

export async function tgIsChannelMember(token: string, channelUsername: string, userId: number) {
  const chatId = channelUsername.startsWith("@") ? channelUsername : `@${channelUsername}`;
  const res = await tgCall<{ status: string }>(token, "getChatMember", { chat_id: chatId, user_id: userId });
  if (!res.ok || !res.result) return false;
  return ["member", "administrator", "creator"].includes(res.result.status);
}
