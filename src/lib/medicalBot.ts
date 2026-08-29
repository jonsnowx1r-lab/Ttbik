import { supabaseAdmin } from "@/lib/supabase";
import type { BotTemplate } from "@/lib/botTemplates";
import { tgAnswerCallback, tgSend } from "@/lib/tgApi";
import { upsertMember, sendMenu, type HostedBot, type TgUser } from "@/lib/botEngine";

/**
 * Medical-facilities bot (pharmacy/hospital/clinic/medical point). Kept in
 * its own module because its conversation shape (contact sharing, a photo+
 * caption registration flow, facility-owner approvals) doesn't fit the
 * generic text/callback router in botEngine.ts used by the other templates.
 *
 * Location/country (owner decision 2026-08-29, question 7.1): determined by
 * having the member share their phone number via Telegram's native
 * request_contact button — the international dialing code maps to a
 * country — with a manual "بلدي: <اسم>" override always available.
 *
 * Facility verification (owner decision 2026-08-29, question 7.2): license
 * number + a photo of the license, submitted together as one Telegram photo
 * message with a delimited caption, reviewed manually by the site owner
 * before the facility is marked verified. The photo is kept as a Telegram
 * file_id (no Supabase Storage cost) — the admin views it by resolving the
 * file through the bot's own token.
 */

const COUNTRY_CODES: Array<[string, string]> = [
  ["963", "سوريا"],
  ["962", "الأردن"],
  ["961", "لبنان"],
  ["964", "العراق"],
  ["966", "السعودية"],
  ["971", "الإمارات"],
  ["965", "الكويت"],
  ["974", "قطر"],
  ["973", "البحرين"],
  ["968", "عُمان"],
  ["20", "مصر"],
  ["90", "تركيا"],
  ["49", "ألمانيا"],
];

function countryFromPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const match = COUNTRY_CODES.find(([code]) => digits.startsWith(code));
  return match ? match[1] : "غير معروف";
}

function contactRequestKeyboard() {
  return {
    keyboard: [[{ text: "📱 مشاركة رقم الهاتف لتحديد بلدك", request_contact: true }]],
    resize_keyboard: true,
  };
}

const FACILITY_TYPE_LABEL: Record<string, string> = {
  pharmacy: "صيدلية",
  hospital: "مشفى",
  clinic: "مستوصف",
  medical_point: "نقطة طبية",
};
function facilityTypeFromText(text: string): string {
  const t = text.trim();
  if (t.includes("صيدل")) return "pharmacy";
  if (t.includes("مشفى") || t.includes("مستشفى")) return "hospital";
  if (t.includes("مستوصف")) return "clinic";
  return "medical_point";
}

export async function handleMedicalUpdate(bot: HostedBot, template: BotTemplate, update: any) {
  const db = supabaseAdmin();

  if (update.callback_query) {
    const cq = update.callback_query;
    const user: TgUser = cq.from;
    const chatId = cq.message?.chat?.id ?? user.id;
    await tgAnswerCallback(bot.bot_token, cq.id);
    const member = await upsertMember(bot.id, user);
    const data = String(cq.data || "");

    if (data.startsWith("gov:")) {
      const govId = data.slice(4);
      const { data: shifts } = await db
        .from("facility_shifts")
        .select("id, starts_at, ends_at, medical_facilities!inner(id, name, facility_type, city_text, verification_status, governorate_id)")
        .eq("medical_facilities.governorate_id", govId)
        .eq("medical_facilities.verification_status", "verified")
        .lte("starts_at", new Date().toISOString())
        .gte("ends_at", new Date().toISOString())
        .limit(10);
      if (!shifts || shifts.length === 0) {
        await sendMenu(bot, template, chatId, "لا توجد منشأة مناوبة موثَّقة الآن في هذه المحافظة.");
        return;
      }
      const inline = {
        inline_keyboard: shifts.map((s: any) => [
          {
            text: `${FACILITY_TYPE_LABEL[s.medical_facilities.facility_type] || "منشأة"} ${s.medical_facilities.name}${s.medical_facilities.city_text ? " — " + s.medical_facilities.city_text : ""}`,
            callback_data: `book:${s.medical_facilities.id}`,
          },
        ]),
      };
      await tgSend(bot.bot_token, chatId, "المنشآت المناوبة الآن:", { reply_markup: inline });
      return;
    }

    if (data.startsWith("book:")) {
      const facilityId = data.slice(5);
      const { data: facility } = await db
        .from("medical_facilities")
        .select("id, name, owner_tg_user_id")
        .eq("id", facilityId)
        .maybeSingle();
      if (!facility) {
        await sendMenu(bot, template, chatId, "المنشأة غير موجودة.");
        return;
      }
      const { data: booking } = await db
        .from("facility_bookings")
        .insert({ facility_id: facilityId, tg_user_id: String(user.id), requested_slot: "الآن", status: "pending" })
        .select("id")
        .single();
      await sendMenu(bot, template, chatId, `أُرسل طلب حجزك إلى «${facility.name}». تابع الحالة من «حجوزاتي».`);
      if (booking) {
        await tgSend(
          bot.bot_token,
          Number(facility.owner_tg_user_id),
          `طلب حجز جديد (#${booking.id.slice(0, 8)}) من ${member.display_name || "مستخدم"}.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "موافقة ✅", callback_data: `bkapp:${booking.id}` },
                { text: "رفض ❌", callback_data: `bkrej:${booking.id}` },
              ]],
            },
          }
        ).catch(() => null);
      }
      return;
    }

    if (data.startsWith("bkapp:") || data.startsWith("bkrej:")) {
      const bookingId = data.slice(6);
      const approve = data.startsWith("bkapp:");
      const { data: booking } = await db
        .from("facility_bookings")
        .select("id, tg_user_id, facility_id, status, medical_facilities(owner_tg_user_id, name)")
        .eq("id", bookingId)
        .maybeSingle();
      const facilityInfo: any = booking && Array.isArray((booking as any).medical_facilities)
        ? (booking as any).medical_facilities[0]
        : (booking as any)?.medical_facilities;
      if (!booking || !facilityInfo || facilityInfo.owner_tg_user_id !== String(user.id)) {
        await sendMenu(bot, template, chatId, "لا تملك صلاحية على هذا الطلب.");
        return;
      }
      if (booking.status !== "pending") {
        await sendMenu(bot, template, chatId, "تمت معالجة هذا الطلب مسبقاً.");
        return;
      }
      await db.from("facility_bookings").update({ status: approve ? "approved" : "rejected" }).eq("id", bookingId);
      await sendMenu(bot, template, chatId, approve ? "تمت الموافقة على الحجز." : "تم رفض الحجز.");
      await tgSend(
        bot.bot_token,
        Number(booking.tg_user_id),
        approve
          ? `تمت الموافقة على حجزك في «${facilityInfo.name}».`
          : `عذراً، رُفض حجزك في «${facilityInfo.name}». يمكنك تجربة منشأة أخرى من «المناوبة الآن».`
      ).catch(() => null);
      return;
    }

    return;
  }

  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const user: TgUser = msg.from;
  const chatId = msg.chat.id;
  const member = await upsertMember(bot.id, user);

  // Contact share → derive & store country from the phone's dialing code.
  if (msg.contact?.phone_number) {
    const country = countryFromPhone(msg.contact.phone_number);
    await db
      .from("bot_members")
      .update({ phone_number: msg.contact.phone_number, country_code: country })
      .eq("bot_id", bot.id)
      .eq("tg_user_id", String(user.id));
    await sendMenu(bot, template, chatId, `تم تحديد بلدك: ${country}.\nإن كان غير دقيق أرسل: بلدي: اسم البلد\n\n${template.defaults.welcome}`);
    return;
  }

  // Facility registration: a single photo message with a delimited caption,
  // instead of a multi-step form — this codebase has no per-user
  // conversation-state tracking, so one message = one command everywhere.
  if (msg.photo && typeof msg.caption === "string" && msg.caption.trim().startsWith("تسجيل:")) {
    const parts = msg.caption.trim().slice(6).split("|").map((s: string) => s.trim());
    const [name, typeText, governorateName, cityText, licenseNumber] = parts;
    if (!name || !governorateName || !licenseNumber) {
      await sendMenu(
        bot,
        template,
        chatId,
        "الصيغة الناقصة. أرسل صورة الترخيص بتعليق:\nتسجيل: الاسم | النوع | المحافظة | المدينة | رقم الترخيص"
      );
      return;
    }
    const { data: gov } = await db
      .from("locations")
      .select("id")
      .eq("level", "governorate")
      .ilike("name", governorateName)
      .maybeSingle();
    const largestPhoto = msg.photo[msg.photo.length - 1];
    const { error } = await db.from("medical_facilities").insert({
      bot_id: bot.id,
      facility_type: facilityTypeFromText(typeText || ""),
      name,
      governorate_id: gov?.id || null,
      city_text: cityText || null,
      owner_tg_user_id: String(user.id),
      license_number: licenseNumber,
      license_photo_file_id: largestPhoto?.file_id || null,
      verification_status: "pending",
    });
    await sendMenu(
      bot,
      template,
      chatId,
      error
        ? `تعذّر التسجيل: ${error.message}`
        : `استُلم تسجيل «${name}». بانتظار مراجعة المالك للترخيص قبل الظهور للمستخدمين.${gov ? "" : "\nملاحظة: لم يُعثر على المحافظة بهذا الاسم — راجع تهجئتها لاحقاً مع المالك."}`
    );
    return;
  }

  const text = String(msg.text || "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    if (!member.phone_number) {
      await tgSend(
        bot.bot_token,
        chatId,
        "أهلاً بك. لتحديد بلدك ورؤية المنشآت المناوبة قرب موقعك، شارك رقم هاتفك من الزر أدناه.",
        { reply_markup: contactRequestKeyboard() }
      );
      return;
    }
    await sendMenu(bot, template, chatId, bot.welcome_text || template.defaults.welcome);
    return;
  }

  if (text.startsWith("بلدي:")) {
    const country = text.slice(5).trim();
    if (!country) {
      await sendMenu(bot, template, chatId, "الصيغة: بلدي: اسم البلد");
      return;
    }
    await db.from("bot_members").update({ country_code: country }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
    await sendMenu(bot, template, chatId, `تم تحديث بلدك إلى: ${country}.`);
    return;
  }

  if (text === "المناوبة الآن") {
    const { data: governorates } = await db.from("locations").select("id, name").eq("level", "governorate").order("name");
    if (!governorates || governorates.length === 0) {
      await sendMenu(bot, template, chatId, "لا توجد محافظات مسجَّلة بعد.");
      return;
    }
    const inline = {
      inline_keyboard: governorates.map((g) => [{ text: g.name, callback_data: `gov:${g.id}` }]),
    };
    await tgSend(bot.bot_token, chatId, "اختر محافظتك:", { reply_markup: inline });
    return;
  }

  if (text === "سجّل منشأتك") {
    await sendMenu(
      bot,
      template,
      chatId,
      "لتسجيل منشأتك (صيدلية/مشفى/مستوصف/نقطة طبية) أرسل صورة ترخيصك بالتعليق التالي:\n\nتسجيل: الاسم | النوع | المحافظة | المدينة | رقم الترخيص\n\nمثال:\nتسجيل: صيدلية الشفاء | صيدلية | دمشق | المزة | 12345\n\nلن تظهر منشأتك للمستخدمين حتى يراجع المالك الترخيص ويوثّقها."
    );
    return;
  }

  if (text === "حجوزاتي") {
    const { data: bookings } = await db
      .from("facility_bookings")
      .select("requested_slot, alternative_slot, status, created_at, medical_facilities(name)")
      .eq("tg_user_id", String(user.id))
      .order("created_at", { ascending: false })
      .limit(8);
    if (!bookings || bookings.length === 0) {
      await sendMenu(bot, template, chatId, "لا حجوزات بعد. استخدم «المناوبة الآن» لطلب حجز.");
      return;
    }
    const statusAr = (s: string) =>
      s === "approved" ? "مؤكد" : s === "rejected" ? "مرفوض" : s === "rescheduled" ? "اقتُرح موعد بديل" : "قيد المراجعة";
    const list = bookings
      .map((b: any) => {
        const facility = Array.isArray(b.medical_facilities) ? b.medical_facilities[0] : b.medical_facilities;
        const alt = b.alternative_slot ? ` (بديل مقترح: ${b.alternative_slot})` : "";
        return `• ${facility?.name || "منشأة"} — ${statusAr(b.status)}${alt}`;
      })
      .join("\n");
    await sendMenu(bot, template, chatId, `حجوزاتك:\n${list}`);
    return;
  }

  if (text === "طلبات الحجز") {
    const { data: myFacilities } = await db.from("medical_facilities").select("id, name").eq("bot_id", bot.id).eq("owner_tg_user_id", String(user.id));
    if (!myFacilities || myFacilities.length === 0) {
      await sendMenu(bot, template, chatId, "لا تملك منشأة مسجَّلة في هذا البوت بعد.");
      return;
    }
    const facilityIds = myFacilities.map((f) => f.id);
    const { data: bookings } = await db
      .from("facility_bookings")
      .select("id, tg_user_id, status, created_at")
      .in("facility_id", facilityIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!bookings || bookings.length === 0) {
      await sendMenu(bot, template, chatId, "لا طلبات حجز معلَّقة.");
      return;
    }
    for (const b of bookings) {
      await tgSend(bot.bot_token, chatId, `طلب #${b.id.slice(0, 8)} من tg:${b.tg_user_id}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: "موافقة ✅", callback_data: `bkapp:${b.id}` },
            { text: "رفض ❌", callback_data: `bkrej:${b.id}` },
          ]],
        },
      });
    }
    return;
  }

  if (text === "مناوباتي") {
    const { data: myFacility } = await db.from("medical_facilities").select("id, name").eq("bot_id", bot.id).eq("owner_tg_user_id", String(user.id)).maybeSingle();
    if (!myFacility) {
      await sendMenu(bot, template, chatId, "سجّل منشأتك أولاً من «سجّل منشأتك».");
      return;
    }
    const { data: shifts } = await db
      .from("facility_shifts")
      .select("starts_at, ends_at")
      .eq("facility_id", myFacility.id)
      .order("starts_at", { ascending: false })
      .limit(5);
    const list = (shifts || []).map((s) => `• ${new Date(s.starts_at).toLocaleString("ar")} → ${new Date(s.ends_at).toLocaleString("ar")}`).join("\n") || "لا مناوبات مسجَّلة.";
    await sendMenu(
      bot,
      template,
      chatId,
      `مناوبات «${myFacility.name}»:\n${list}\n\nلإضافة مناوبة أرسل:\nمناوبة: 2026-08-30 08:00 | 2026-08-31 08:00`
    );
    return;
  }

  if (text.startsWith("مناوبة:")) {
    const { data: myFacility } = await db.from("medical_facilities").select("id").eq("bot_id", bot.id).eq("owner_tg_user_id", String(user.id)).maybeSingle();
    if (!myFacility) {
      await sendMenu(bot, template, chatId, "سجّل منشأتك أولاً من «سجّل منشأتك».");
      return;
    }
    const [startRaw, endRaw] = text.slice(7).split("|").map((s) => s.trim());
    const start = startRaw ? new Date(startRaw.replace(" ", "T")) : null;
    const end = endRaw ? new Date(endRaw.replace(" ", "T")) : null;
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      await sendMenu(bot, template, chatId, "الصيغة: مناوبة: 2026-08-30 08:00 | 2026-08-31 08:00");
      return;
    }
    const { error } = await db.from("facility_shifts").insert({ facility_id: myFacility.id, starts_at: start.toISOString(), ends_at: end.toISOString() });
    await sendMenu(bot, template, chatId, error ? `تعذّرت الإضافة: ${error.message}` : "أُضيفت المناوبة.");
    return;
  }

  if (text.startsWith("بديل:")) {
    const [bookingIdPart, altText] = text.slice(5).split("|").map((s) => s.trim());
    // Booking ids are uuid columns — Postgres rejects ILIKE on uuid directly
    // (needs a text cast), and we only ever show the first 8 chars of the id
    // to the facility owner anyway, so match the prefix in JS instead of SQL:
    // fetch this owner's own pending bookings, then find the one whose id
    // starts with what they typed.
    const { data: myFacilities } = await db.from("medical_facilities").select("id, name").eq("bot_id", bot.id).eq("owner_tg_user_id", String(user.id));
    const facilityIds = (myFacilities || []).map((f) => f.id);
    const { data: candidates } = facilityIds.length
      ? await db.from("facility_bookings").select("id, tg_user_id, facility_id").in("facility_id", facilityIds).eq("status", "pending")
      : { data: [] as any[] };
    const booking = (candidates || []).find((b) => b.id.startsWith(bookingIdPart));
    const facilityInfo = booking ? myFacilities?.find((f) => f.id === booking.facility_id) : null;
    if (!booking || !altText || !facilityInfo) {
      await sendMenu(bot, template, chatId, "الصيغة: بديل: رقم الطلب | الوقت البديل");
      return;
    }
    await db.from("facility_bookings").update({ status: "rescheduled", alternative_slot: altText }).eq("id", booking.id);
    await sendMenu(bot, template, chatId, "أُرسل الموعد البديل.");
    await tgSend(bot.bot_token, Number(booking.tg_user_id), `اقترح «${facilityInfo.name}» موعداً بديلاً: ${altText}\nراجع «حجوزاتي».`).catch(() => null);
    return;
  }

  if (text === "تواصل") {
    await sendMenu(bot, template, chatId, bot.config?.contact || template.defaults.extra.contact);
    return;
  }
  if (text === "الأسئلة الشائعة") {
    await sendMenu(bot, template, chatId, bot.config?.faq || template.defaults.faq);
    return;
  }

  await sendMenu(bot, template, chatId, "اختر أحد الأزرار من القائمة.");
}
