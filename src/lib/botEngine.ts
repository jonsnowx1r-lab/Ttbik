import { supabaseAdmin } from "@/lib/supabase";
import { getBotTemplate, replyKeyboard, type BotTemplate } from "@/lib/botTemplates";
import { siteBase } from "@/lib/botCodes";
import { tgAnswerCallback, tgSend } from "@/lib/tgApi";

export type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
export type HostedBot = {
  id: string;
  public_code: string;
  template_type: string;
  bot_token: string;
  welcome_text: string | null;
  config: Record<string, any> | null;
  status: string;
};

export async function upsertMember(botId: string, user: TgUser) {
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

// Withdrawal eligibility for the ad-campaign bot only (the one explicit
// exception to the site-wide no-cash-withdrawal rule, per owner decision
// 2026-08-29). Deliberately conservative starting defaults — tune from real
// usage once the bot has been live a while; the owner still reviews and
// approves every withdrawal manually before any money actually moves.
const MIN_WITHDRAWAL_POINTS = 50;
const MIN_ACCOUNT_AGE_DAYS = 7;

export async function sendMenu(bot: HostedBot, template: BotTemplate, chatId: number, text: string) {
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

  // Medical-facilities bot has its own conversation shape (contact sharing,
  // photo+caption registration, facility-owner approvals) that doesn't fit
  // the generic text/callback routing below — handled in its own module.
  if (template.id === "medical") {
    const { handleMedicalUpdate } = await import("@/lib/medicalBot");
    await handleMedicalUpdate(bot, template, update);
    return;
  }

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
    if (data.startsWith("slot:")) {
      const slotLabel = data.slice(5).trim();
      if (!slotLabel) {
        await sendMenu(bot, template, chatId, "موعد غير صالح. اختر من «حجز موعد» مرة أخرى.");
        return;
      }
      await supabaseAdmin().from("bot_appointments").insert({
        bot_id: bot.id,
        tg_user_id: String(user.id),
        display_name: member.display_name,
        slot_label: slotLabel,
        status: "pending",
      });
      await sendMenu(
        bot,
        template,
        chatId,
        `تم تسجيل حجز مبدئي:\n${slotLabel}\n\nستظهر حالة التأكيد هنا وفي «مواعيدي» بعد مراجعة المالك.`
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
    const withdrawLine =
      template.id === "ad-campaign"
        ? `\n\nللسحب اضغط زر «سحب».`
        : `\n\nالنقاط للاستخدام داخل البوت فقط. لا يوجد سحب نقدي.`;
    await sendMenu(
      bot,
      template,
      chatId,
      `رصيدك: ${points} ${template.defaults.currencyName}\n\nشراء نقاط عبر الموقع (بعد مراجعة المالك):\n${depositLink(bot, user.id)}${withdrawLine}`
    );
    return;
  }

  if (text === "سحب" && template.id === "ad-campaign") {
    const accountAgeDays = member.created_at
      ? Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000)
      : 0;
    const missing: string[] = [];
    if (points < MIN_WITHDRAWAL_POINTS) missing.push(`رصيد لا يقل عن ${MIN_WITHDRAWAL_POINTS} ${template.defaults.currencyName} (رصيدك الآن ${points})`);
    if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) missing.push(`عمر حساب ${MIN_ACCOUNT_AGE_DAYS} أيام على الأقل (حسابك عمره ${accountAgeDays} يوم)`);
    if (missing.length) {
      await sendMenu(bot, template, chatId, `السحب غير متاح بعد. المطلوب:\n• ${missing.join("\n• ")}`);
      return;
    }
    await sendMenu(
      bot,
      template,
      chatId,
      `رصيدك المتاح للسحب: ${points} ${template.defaults.currencyName}\nلطلب السحب أرسل:\nسحب: عدد النقاط\n\nمثال: سحب: 50\n\nيُخصم المبلغ من رصيدك فوراً ويُراجَع طلبك يدوياً من المالك قبل التحويل الفعلي.`
    );
    return;
  }

  if (text.startsWith("سحب:") && template.id === "ad-campaign") {
    const amount = Number(text.slice(4).trim());
    const accountAgeDays = member.created_at
      ? Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000)
      : 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendMenu(bot, template, chatId, "الصيغة: سحب: عدد النقاط (رقم أكبر من صفر).");
      return;
    }
    if (points < MIN_WITHDRAWAL_POINTS || accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
      await sendMenu(bot, template, chatId, "لا تستوفي شروط السحب بعد. اضغط «سحب» لمعرفة التفاصيل.");
      return;
    }
    if (amount > points) {
      await sendMenu(bot, template, chatId, `رصيدك ${points} فقط، لا يمكن سحب ${amount}.`);
      return;
    }
    const db = supabaseAdmin();
    const newPoints = points - amount;
    await db.from("bot_members").update({ points: newPoints }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
    await db.from("bot_wallet_tx").insert({
      bot_id: bot.id,
      tg_user_id: String(user.id),
      kind: "withdrawal",
      amount,
      status: "pending",
      payment_method: null,
      note: "طلب سحب بانتظار مراجعة المالك",
    });
    await sendMenu(
      bot,
      template,
      chatId,
      `تم استلام طلب سحب ${amount} ${template.defaults.currencyName}.\nرصيدك الآن: ${newPoints}.\nسيراجع المالك الطلب ويحوّل المبلغ يدوياً، أو يرفضه فتُعاد النقاط لرصيدك. تابع الحالة في «طلباتي».`
    );
    return;
  }

  if (text === "المنتجات" || (text === "خدماتنا" && template.id === "clinic")) {
    if (template.id === "store") {
      const db = supabaseAdmin();
      const { data: dbProducts } = await db
        .from("store_products")
        .select("name, price")
        .eq("bot_id", bot.id)
        .eq("is_active", true);
      const items =
        dbProducts && dbProducts.length
          ? dbProducts.map((p) => (p.price != null ? `${p.name} — ${p.price}` : p.name))
          : Array.isArray(cfg.products) && cfg.products.length
            ? cfg.products
            : ["المنتج الأساسي"];
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
    // Inline keyboard: one button per ad → existing ad:ID callback opens claim page
    const inline = {
      inline_keyboard: ads.slice(0, 8).map((a) => [
        {
          text: `${a.title} (+${a.reward_points})`,
          callback_data: `ad:${a.id}`,
        },
      ]),
    };
    await tgSend(
      bot.bot_token,
      chatId,
      `الحملات النشطة الآن:\n${list}\n\nاضغط زر الحملة للمشاهدة، أو افتح القائمة:\n${link}`,
      { reply_markup: inline }
    );
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
                  : t.kind === "ad_view"
                    ? "مشاهدة إعلان"
                    : t.kind === "withdrawal"
                      ? "طلب سحب"
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
    // Three concrete upcoming slots with Arabic labels for clarity
    const slots = [
      { label: "غداً 10:00", value: "غداً 10:00" },
      { label: "غداً 16:00", value: "غداً 16:00" },
      { label: "بعد غد 10:00", value: "بعد غد 10:00" },
    ];
    const inline = {
      inline_keyboard: slots.map((s) => [{ text: s.label, callback_data: `slot:${s.value}` }]),
    };
    await tgSend(
      bot.bot_token,
      chatId,
      "اختر موعداً مقترحاً (قيد المراجعة حتى يؤكد المالك):",
      { reply_markup: inline }
    );
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
  if (template.id === "store" && text === "متجري") {
    await sendMenu(
      bot,
      template,
      chatId,
      `إدارة متجرك — لأي عضو يرسل الصيغة التالية الآن (مرحلة اختبار الإدمن، لا تحقق هوية تاجر بعد):\n\nمنتج: الاسم | السعر | الوصف\n\nمثال:\nمنتج: قميص قطن | 15 | مقاسات S-XL متوفرة`
    );
    return;
  }

  if (template.id === "store" && text.startsWith("منتج:")) {
    const parts = text.slice(5).split("|").map((s) => s.trim());
    const [name, priceRaw, description] = parts;
    if (!name) {
      await sendMenu(bot, template, chatId, "الصيغة: منتج: الاسم | السعر | الوصف");
      return;
    }
    const price = priceRaw ? Number(priceRaw) : null;
    const db = supabaseAdmin();
    const { error } = await db.from("store_products").insert({
      bot_id: bot.id,
      name,
      price: Number.isFinite(price as number) ? price : null,
      description: description || null,
      is_active: true,
    });
    await sendMenu(
      bot,
      template,
      chatId,
      error ? `تعذّرت الإضافة: ${error.message}` : `أُضيف المنتج «${name}» إلى «المنتجات».`
    );
    return;
  }

  if (template.id === "store" && text === "بيع مستعمل") {
    await sendMenu(
      bot,
      template,
      chatId,
      `لعرض سلعة مستعملة للبيع أرسل الصيغة التالية:\n\nمستعمل: العنوان | السعر | الوصف\n\nمثال:\nمستعمل: دراجة هوائية | 40 | استعمال خفيف، بلا أعطال`
    );
    return;
  }

  if (template.id === "store" && text.startsWith("مستعمل:")) {
    const parts = text.slice(7).split("|").map((s) => s.trim());
    const [title, priceRaw, description] = parts;
    if (!title) {
      await sendMenu(bot, template, chatId, "الصيغة: مستعمل: العنوان | السعر | الوصف");
      return;
    }
    const price = priceRaw ? Number(priceRaw) : null;
    const db = supabaseAdmin();
    const { error } = await db.from("marketplace_listings").insert({
      bot_id: bot.id,
      tg_user_id: String(user.id),
      title,
      price: Number.isFinite(price as number) ? price : null,
      description: description || null,
      status: "available",
    });
    await sendMenu(
      bot,
      template,
      chatId,
      error ? `تعذّر النشر: ${error.message}` : `نُشرت سلعتك «${title}» في «شراء مستعمل».`
    );
    return;
  }

  if (template.id === "store" && (text === "شراء مستعمل" || text.startsWith("بحث:"))) {
    const db = supabaseAdmin();
    let query = db
      .from("marketplace_listings")
      .select("title, price, description")
      .eq("bot_id", bot.id)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(10);
    if (text.startsWith("بحث:")) {
      const keyword = text.slice(4).trim();
      if (keyword) query = query.ilike("title", `%${keyword}%`);
    }
    const { data: listings } = await query;
    if (!listings || listings.length === 0) {
      await sendMenu(bot, template, chatId, "لا توجد سلع مستعملة معروضة حالياً. للبحث باسم: بحث: اسم السلعة");
      return;
    }
    const list = listings
      .map((l) => `• ${l.title}${l.price != null ? ` — ${l.price}` : ""}${l.description ? `\n  ${l.description}` : ""}`)
      .join("\n");
    await sendMenu(bot, template, chatId, `السلع المستعملة المعروضة:\n${list}\n\nللبحث باسم: بحث: اسم السلعة`);
    return;
  }

  // Store: text matching a product name → pending order request
  if (template.id === "store") {
    const db = supabaseAdmin();
    const { data: dbProducts } = await db
      .from("store_products")
      .select("name")
      .eq("bot_id", bot.id)
      .eq("is_active", true);
    const items = [
      ...(dbProducts ? dbProducts.map((p) => p.name) : []),
      ...(Array.isArray(cfg.products) ? cfg.products.map(String) : []),
    ];
    const match = items.find((p) => p === text || p.startsWith(text) || text.startsWith(p.split("—")[0].trim()) || text.startsWith(p.split("-")[0].trim()));
    if (match) {
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
