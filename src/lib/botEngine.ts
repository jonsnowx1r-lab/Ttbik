import { supabaseAdmin } from "@/lib/supabase";
import { getBotTemplate, replyKeyboard, type BotTemplate } from "@/lib/botTemplates";
import { siteBase } from "@/lib/botCodes";
import { tgAnswerCallback, tgSend } from "@/lib/tgApi";

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
type HostedBot = {
  id: string;
  public_code: string;
  template_type: string;
  bot_token: string;
  welcome_text: string | null;
  config: Record<string, any> | null;
  status: string;
};

async function upsertMember(botId: string, user: TgUser) {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("bot_members")
    .select("*")
    .eq("bot_id", botId)
    .eq("tg_user_id", String(user.id))
    .maybeSingle();
  if (existing) return existing;
  const row = {
    bot_id: botId,
    tg_user_id: String(user.id),
    username: user.username ? `@${user.username}` : null,
    display_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "عضو",
    points: 0,
  };
  const { data, error } = await db.from("bot_members").insert(row).select("*").single();
  if (error) return { ...row, id: null, points: 0 };
  return data;
}

function depositLink(bot: HostedBot, userId: number) {
  return `${siteBase()}/pay/bot/${bot.public_code}?uid=${userId}`;
}

async function sendMenu(bot: HostedBot, template: BotTemplate, chatId: number, text: string) {
  await tgSend(bot.bot_token, chatId, text, { reply_markup: replyKeyboard(template) });
}

export async function handleBotUpdate(bot: HostedBot, update: any) {
  const template = getBotTemplate(bot.template_type);
  if (!template || bot.status !== "live") return;

  if (update.callback_query) {
    const cq = update.callback_query;
    const user: TgUser = cq.from;
    const chatId = cq.message?.chat?.id ?? user.id;
    await tgAnswerCallback(bot.bot_token, cq.id);
    const member = await upsertMember(bot.id, user);
    const data = String(cq.data || "");
    if (data.startsWith("ad:")) {
      await tgSend(
        bot.bot_token,
        chatId,
        `افتح رابط المشاهدة:\n${siteBase()}/bots/live/${bot.public_code}/ads?uid=${user.id}&ad=${data.slice(3)}`
      );
      return;
    }
    await routeText(bot, template, member, chatId, user, data);
    return;
  }

  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const user: TgUser = msg.from;
  const chatId = msg.chat.id;
  const text = String(msg.text || "").trim();
  const member = await upsertMember(bot.id, user);

  if (text.startsWith("/start") || text === "Home") {
    const welcome = bot.welcome_text || template.defaults.welcome;
    await sendMenu(
      bot,
      template,
      chatId,
      `${welcome}\n\nرمز البوت: ${bot.public_code}\nرصيدك: ${member.points ?? 0} ${template.defaults.currencyName}`
    );
    return;
  }

  await routeText(bot, template, member, chatId, user, text);
}

async function routeText(
  bot: HostedBot,
  template: BotTemplate,
  member: any,
  chatId: number,
  user: TgUser,
  text: string
) {
  const points = Number(member.points || 0);
  const cfg = bot.config || {};

  if (text === "الرصيد" || text === "الأرباح") {
    await sendMenu(
      bot,
      template,
      chatId,
      `رصيدك: ${points} ${template.defaults.currencyName}\n\nشراء نقاط عبر الموقع (بعد مراجعة المالك):\n${depositLink(bot, user.id)}\n\nالنقاط للاستخدام داخل البوت فقط. لا يوجد سحب نقدي.`
    );
    return;
  }

  if (text === "الإعلانات" || text === "المنتجات" || text === "خدماتنا") {
    if (template.id === "store") {
      const items = Array.isArray(cfg.products) && cfg.products.length ? cfg.products : ["المنتج الأساسي"];
      await sendMenu(bot, template, chatId, `المنتجات:\n• ${items.join("\n• ")}`);
      return;
    }
    await sendMenu(bot, template, chatId, `لا حملات نشطة حالياً.\n${siteBase()}/bots/live/${bot.public_code}/ads?uid=${user.id}`);
    return;
  }

  if (text === "الإحالات") {
    await sendMenu(bot, template, chatId, `رابط الإحالة:\nhttps://t.me/${cfg.botUsername || "bot"}?start=${bot.public_code}_${user.id}`);
    return;
  }
  if (text === "المسابقات") {
    await sendMenu(bot, template, chatId, cfg.contest || template.defaults.extra.contest || "لا مسابقة حالياً.");
    return;
  }
  if (text === "الإعدادات") {
    await sendMenu(bot, template, chatId, `الاسم: ${member.display_name}\nالرصيد: ${points}`);
    return;
  }
  if (text === "الأسئلة الشائعة") {
    await sendMenu(bot, template, chatId, cfg.faq || template.defaults.faq);
    return;
  }
  if (text === "الدعم" || text === "التواصل") {
    await sendMenu(bot, template, chatId, cfg.support || cfg.contact || "تواصل عبر المالك.");
    return;
  }
  if (text === "طلباتي") {
    await sendMenu(bot, template, chatId, "لا توجد عمليات بعد.");
    return;
  }
  if (text === "حجز موعد") {
    const slot = new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace("T", " ");
    await supabaseAdmin().from("bot_appointments").insert({
      bot_id: bot.id,
      tg_user_id: String(user.id),
      display_name: member.display_name,
      slot_label: slot,
      status: "pending",
    });
    await sendMenu(bot, template, chatId, `تم تسجيل حجز مبدئي:\n${slot}`);
    return;
  }
  if (text === "مواعيدي") {
    await sendMenu(bot, template, chatId, "لا مواعيد مسجَّلة أو راجع لوحة الموقع.");
    return;
  }
  await sendMenu(bot, template, chatId, "اختر أحد الأزرار من القائمة.");
}
