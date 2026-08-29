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

/** Record an internal points movement for audit (no cash). */
async function logPointsTx(
  botId: string,
  tgUserId: string,
  kind: string,
  amount: number,
  note: string
) {
  const { error } = await supabaseAdmin()
    .from("bot_wallet_tx")
    .insert({
      bot_id: botId,
      tg_user_id: tgUserId,
      kind,
      amount,
      status: "confirmed",
      payment_method: null,
      note,
    });
  if (error) console.error("logPointsTx failed:", error.message);
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

  if (text.startsWith("/start")) {
    const payload = text.slice(6).trim();
    if (payload) {
      await maybeApplyReferral(bot, member, user, payload);
    }
    const welcome = bot.welcome_text || template.defaults.welcome;
    await sendMenu(bot, template, chatId, welcome);
    return;
  }

  await routeText(bot, template, member, chatId, user, text);
}

async function maybeApplyReferral(
  bot: HostedBot,
  member: any,
  user: TgUser,
  payload: string
) {
  if (member.referred_by || !payload.includes("_")) return Number(member.points || 0);
  const [code, referrerId] = payload.split("_");
  if (code !== bot.public_code || !referrerId || referrerId === String(user.id)) {
    return Number(member.points || 0);
  }
  const db = supabaseAdmin();
  const { data: referrer } = await db
    .from("bot_members")
    .select("id, points")
    .eq("bot_id", bot.id)
    .eq("tg_user_id", referrerId)
    .maybeSingle();
  if (!referrer) return Number(member.points || 0);

  const REFERRAL_BONUS = 5;
  await db.from("bot_members").update({ points: Number(referrer.points || 0) + REFERRAL_BONUS }).eq("id", referrer.id);
  await db.from("bot_members").update({ referred_by: referrerId }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
  await logPointsTx(bot.id, referrerId, "referral", REFERRAL_BONUS, `إحالة عضو ${user.id}`);
  await tgSend(bot.bot_token, Number(referrerId), `🎉 أحلت عضواً جديداً وحصلت على ${REFERRAL_BONUS} نقطة إضافية!`).catch(() => null);
  return Number(member.points || 0);
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

  if (text === "المنتجات" || (text === "خدماتنا" && template.id === "clinic")) {
    if (template.id === "store") {
      const items = Array.isArray(cfg.products) && cfg.products.length ? cfg.products : ["المنتج الأساسي"];
      await sendMenu(
        bot,
        template,
        chatId,
        `المنتجات:\n• ${items.join("\n• ")}\n\nاكتب اسم المنتج كما هو بالضبط لإرسال طلب. يظهر في «طلباتي».`
      );
      return;
    }
    if (template.id === "clinic") {
      const items =
        (Array.isArray(cfg.services) && cfg.services.length ? cfg.services : null) ||
        (Array.isArray(cfg.products) && cfg.products.length ? cfg.products : null) ||
        [template.defaults.extra?.hours || "استشارة عامة"];
      await sendMenu(bot, template, chatId, `خدماتنا:\n• ${items.join("\n• ")}`);
      return;
    }
  }

  if (text === "الإعلانات") {
    const db = supabaseAdmin();
    const { data: ads } = await db
      .from("bot_ads")
      .select("id, title, reward_points")
      .eq("bot_id", bot.id)
      .eq("is_active", true);
    const link = `${siteBase()}/bots/live/${bot.public_code}/ads?uid=${user.id}`;
    if (!ads || ads.length === 0) {
      await sendMenu(bot, template, chatId, `لا حملات نشطة حالياً. تابع هذه القائمة، ستظهر هنا فور إطلاق حملة جديدة.`);
      return;
    }
    const list = ads.map((a) => `• ${a.title} — ${a.reward_points} ${template.defaults.currencyName}`).join("\n");
    await sendMenu(bot, template, chatId, `الحملات النشطة الآن:\n${list}\n\nشاهد وأكّد من هنا لتُضاف النقاط فوراً:\n${link}`);
    return;
  }

  if (text === "🎁 حضور يومي") {
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    if (member.last_checkin === today) {
      await sendMenu(bot, template, chatId, `سجّلت حضورك اليوم بالفعل. عد غداً لتحصل على نقاط إضافية 🎁`);
      return;
    }
    const CHECKIN_BONUS = 3;
    const newPoints = points + CHECKIN_BONUS;
    await db.from("bot_members").update({ points: newPoints, last_checkin: today }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
    await logPointsTx(bot.id, String(user.id), "checkin", CHECKIN_BONUS, `حضور يومي ${today}`);
    await sendMenu(bot, template, chatId, `🎁 حصلت على ${CHECKIN_BONUS} ${template.defaults.currencyName} لحضورك اليوم!\nرصيدك الآن: ${newPoints}`);
    return;
  }

  if (text === "🏆 المتصدرون") {
    const db = supabaseAdmin();
    const { data: top } = await db
      .from("bot_members")
      .select("display_name, points")
      .eq("bot_id", bot.id)
      .order("points", { ascending: false })
      .limit(5);
    if (!top || top.length === 0) {
      await sendMenu(bot, template, chatId, `لا يوجد أعضاء بعد.`);
      return;
    }
    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const list = top.map((m, i) => `${medals[i]} ${m.display_name || "عضو"} — ${m.points} ${template.defaults.currencyName}`).join("\n");
    await sendMenu(bot, template, chatId, `🏆 المتصدرون:\n${list}`);
    return;
  }

  if (text === "الإحالات") {
    const uname = cfg.botUsername || bot.config?.botUsername || "";
    const handle = uname ? (String(uname).startsWith("@") ? String(uname).slice(1) : String(uname)) : "bot";
    await sendMenu(bot, template, chatId, `رابط الإحالة:\nhttps://t.me/${handle}?start=${bot.public_code}_${user.id}`);
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
    const db = supabaseAdmin();
    const { data: txs } = await db
      .from("bot_wallet_tx")
      .select("kind, amount, status, payment_method, note, created_at")
      .eq("bot_id", bot.id)
      .eq("tg_user_id", String(user.id))
      .order("created_at", { ascending: false })
      .limit(8);
    if (!txs || txs.length === 0) {
      await sendMenu(
        bot,
        template,
        chatId,
        `لا طلبات مسجَّلة بعد.\nاشترِ رصيداً من هنا:\n${depositLink(bot, user.id)}`
      );
      return;
    }
    const statusAr = (s: string) =>
      s === "approved" || s === "confirmed" || s === "مؤكد"
        ? "مؤكد"
        : s === "pending" || s === "قيد المراجعة"
          ? "قيد المراجعة"
          : s === "rejected" || s === "مرفوض"
            ? "مرفوض"
            : s;
    const list = txs
      .map((t) => {
        const kind =
          t.kind === "deposit"
            ? "إيداع"
            : t.kind === "order"
              ? "طلب منتج"
              : t.kind === "checkin"
                ? "حضور يومي"
                : t.kind === "referral"
                  ? "إحالة"
                  : String(t.kind || "عملية");
        const when = t.created_at ? String(t.created_at).slice(0, 10) : "";
        const extra = t.note ? ` — ${t.note}` : t.amount ? ` ${t.amount}` : "";
        return `• ${kind}${extra} — ${statusAr(String(t.status || "pending"))}${when ? ` (${when})` : ""}`;
      })
      .join("\n");
    await sendMenu(bot, template, chatId, `طلباتك:\n${list}`);
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
    await sendMenu(bot, template, chatId, `تم تسجيل حجز مبدئي:\n${slot}\n\nستظهر حالة التأكيد هنا وفي «مواعيدي» بعد مراجعة المالك.`);
    return;
  }
  if (text === "مواعيدي") {
    const db = supabaseAdmin();
    const { data: appts } = await db
      .from("bot_appointments")
      .select("slot_label, status")
      .eq("bot_id", bot.id)
      .eq("tg_user_id", String(user.id))
      .order("slot_label", { ascending: false })
      .limit(8);
    if (!appts || appts.length === 0) {
      await sendMenu(
        bot,
        template,
        chatId,
        "لا مواعيد مسجَّلة. استخدم «حجز موعد» لطلب موعد جديد."
      );
      return;
    }
    const statusAr = (s: string) =>
      s === "confirmed" || s === "مؤكد"
        ? "مؤكد"
        : s === "pending" || s === "قيد المراجعة"
          ? "قيد المراجعة"
          : s === "cancelled" || s === "ملغى"
            ? "ملغى"
            : s;
    const list = appts
      .map((a) => `• ${a.slot_label} — ${statusAr(String(a.status || "pending"))}`)
      .join("\n");
    await sendMenu(bot, template, chatId, `مواعيدك:\n${list}`);
    return;
  }
  // Store: text matching a product name → pending order request
  if (template.id === "store") {
    const items = Array.isArray(cfg.products) && cfg.products.length ? cfg.products.map(String) : [];
    const match = items.find((p) => p === text || p.startsWith(text) || text.startsWith(p.split("—")[0].trim()) || text.startsWith(p.split("-")[0].trim()));
    if (match) {
      const db = supabaseAdmin();
      await db.from("bot_wallet_tx").insert({
        bot_id: bot.id,
        tg_user_id: String(user.id),
        kind: "order",
        amount: 0,
        status: "pending",
        payment_method: null,
        note: match,
      });
      await sendMenu(
        bot,
        template,
        chatId,
        `تم تسجيل طلبك:\n• ${match}\n\nالحالة: قيد المراجعة.\nتابع في «طلباتي» بعد تأكيد المالك.`
      );
      return;
    }
  }

  await sendMenu(bot, template, chatId, "اختر أحد الأزرار من القائمة.");
}
