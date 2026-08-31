// Minimal AR/EN dictionary for the AD_BOT's end-user-facing screens (owner
// request 2026-08-31: "at least ar/en"). The Super Admin panel stays
// Arabic-only — it's a single-operator surface (the platform owner), not
// a multi-audience one, so translating it doubles the work for zero real
// benefit; everything an ordinary member or bot creator sees is covered.

export type Lang = "ar" | "en";
export const DEFAULT_LANG: Lang = "ar";

type Dict = Record<string, { ar: string; en: string }>;

export const STR: Dict = {
  btnCreateAd: { ar: "➕ ضع إعلانك", en: "➕ Create Ad" },
  btnWatchEarn: { ar: "👀 شاهد واربح", en: "👀 Watch & Earn" },
  btnWallet: { ar: "💰 المحفظة", en: "💰 Wallet" },
  btnReferrals: { ar: "🙌 الإحالات", en: "🙌 Referrals" },
  btnStats: { ar: "📊 إحصائيات", en: "📊 Stats" },
  btnEarnings: { ar: "💼 أرباحي", en: "💼 My Earnings" },
  btnLanguage: { ar: "🌐 اللغة", en: "🌐 Language" },
  btnFaq: { ar: "❓ الأسئلة الشائعة", en: "❓ FAQ" },
  btnDeposit: { ar: "📥 إيداع", en: "📥 Deposit" },
  btnWithdraw: { ar: "📤 سحب", en: "📤 Withdraw" },
  btnBack: { ar: "🔙 القائمة الرئيسية", en: "🔙 Main Menu" },
  btnRetweet: { ar: "🔁 إعادة تغريد", en: "🔁 Retweet" },
  btnFollow: { ar: "➕ متابعة", en: "➕ Follow" },
  btnConfirmSend: { ar: "✅ تأكيد الإرسال", en: "✅ Confirm" },
  btnCancel: { ar: "❌ إلغاء", en: "❌ Cancel" },
  btnDepositNow: { ar: "💳 إيداع الآن", en: "💳 Deposit Now" },
  btnLangAr: { ar: "🇸🇦 العربية", en: "🇸🇦 Arabic" },
  btnLangEn: { ar: "🇬🇧 English", en: "🇬🇧 English" },

  welcome: { ar: "🚀 مرحباً بك في منصة الإعلانات! اختر من القائمة أدناه:", en: "🚀 Welcome to the ads platform! Choose from the menu below:" },
  adminNote: { ar: "\n\n🛠 أنت مالك المنصة — أرسل /admin لفتح لوحة التحكم.", en: "\n\n🛠 You're the platform owner — send /admin to open the control panel." },
  mainMenuTitle: { ar: "🏠 القائمة الرئيسية:", en: "🏠 Main menu:" },
  chooseUnknown: { ar: "يرجى الاختيار من القائمة السفلية فقط.", en: "Please choose from the menu below only." },

  createAdTitle: { ar: "📢 إضافة إعلان جديد\nاختر المنصة:", en: "📢 New ad\nChoose a platform:" },
  choosePlatform: { ar: "اختر المنصة:", en: "Choose a platform:" },
  walletTitle: { ar: "💳 قسم المحفظة", en: "💳 Wallet" },
  walletBalance: { ar: "رصيدك الحالي: {balance}\nاختر العملية المطلوبة:", en: "Your balance: {balance}\nChoose an action:" },
  referralLink: { ar: "🔗 رابط الإحالة الخاص بك:\n{link}", en: "🔗 Your referral link:\n{link}" },
  langCurrent: { ar: "اختر لغتك المفضّلة:", en: "Choose your preferred language:" },
  langSet: { ar: "✅ تم تعيين اللغة إلى العربية.", en: "✅ Language set to English." },
  faqBody: {
    ar: "❓ الأسئلة الشائعة:\n\n• كيف أربح؟ اضغط «شاهد واربح»، اختر منصة، وأتمّ المهام المتاحة.\n• كيف أعلن؟ اضغط «ضع إعلانك»، حدد ميزانيتك وسعر النقرة.\n• كيف أودع/أسحب؟ من «المحفظة».\n• هل التحقق حقيقي؟ نعم لقنوات تلجرام فقط (لا يوجد API مجاني للتحقق من متابعة/تغريد على منصات أخرى).",
    en: "❓ FAQ:\n\n• How do I earn? Tap \"Watch & Earn\", pick a platform, complete available tasks.\n• How do I advertise? Tap \"Create Ad\", set your budget and cost-per-click.\n• How do I deposit/withdraw? From \"Wallet\".\n• Is verification real? Yes, for Telegram channels only (no free API exists to verify a follow/retweet on other platforms).",
  },

  withdrawAmountPrompt: { ar: "أرسل المبلغ المراد سحبه بالدولار (الحد الأدنى ${min}):", en: "Send the amount to withdraw in USD (minimum ${min}):" },
  withdrawMinError: { ar: "الحد الأدنى للسحب ${min}. أرسل رقماً صحيحاً.", en: "Minimum withdrawal is ${min}. Send a valid number." },
  withdrawInsufficient: { ar: "رصيدك {balance} فقط.", en: "Your balance is only {balance}." },
  withdrawSent: { ar: "تم إرسال طلب سحب {amount}. سيُراجَع من مالك المنصة.", en: "Withdrawal request for {amount} sent. It will be reviewed by the platform owner." },

  adSubtypePrompt: { ar: "اختر نوع مهمة تويتر:", en: "Choose the Twitter task type:" },
  adDescriptionPrompt: { ar: "أرسل وصف حملتك (نص قصير يظهر للمستخدمين):", en: "Send your campaign description (short text shown to users):" },
  adTargetPrompt: { ar: "أرسل الرابط/الحساب/القناة الذي تريد الترويج له:", en: "Send the link/account/channel you want to promote:" },
  adBudgetPrompt: { ar: "حدد ميزانية حملتك بالدولار (مثال: 100):", en: "Set your campaign budget in USD (example: 100):" },
  adCpcPrompt: { ar: "حدد السعر لكل نقرة/مهمة بالدولار (الحد الأدنى ${min}):", en: "Set the cost per click/task in USD (minimum ${min}):" },
  adDescriptionEmptyError: { ar: "أرسل وصفاً غير فارغ.", en: "Send a non-empty description." },
  adBudgetError: { ar: "أرسل رقماً صحيحاً أكبر من صفر بالدولار.", en: "Send a valid number greater than zero, in USD." },
  adCpcMinError: { ar: "السعر لكل نقرة على {platform} لا يقل عن ${min}.", en: "Cost per click on {platform} must be at least ${min}." },
  adCpcOverBudgetError: { ar: "السعر لكل نقرة أكبر من الميزانية الكلية.", en: "Cost per click is greater than the total budget." },
  adReviewTitle: { ar: "مراجعة حملتك — {platform}", en: "Review your campaign — {platform}" },
  adReviewType: { ar: "النوع: {type}", en: "Type: {type}" },
  adReviewDesc: { ar: "الوصف: {desc}", en: "Description: {desc}" },
  adReviewTarget: { ar: "الهدف: {target}", en: "Target: {target}" },
  adReviewBudget: { ar: "الميزانية: {budget}", en: "Budget: {budget}" },
  adReviewCpc: { ar: "سعر النقرة: {cpc}", en: "Cost per click: {cpc}" },
  adReviewClicks: { ar: "عدد النقرات المتوقع: ~{clicks}", en: "Expected clicks: ~{clicks}" },
  adCancelled: { ar: "أُلغيت الحملة.", en: "Campaign cancelled." },
  adInsufficientBalance: {
    ar: "الميزانية {budget} أكبر من رصيدك ({balance}).\nأودع رصيداً ثم اضغط «✅ تأكيد الإرسال» مجدداً:\n{link}",
    en: "Budget {budget} is greater than your balance ({balance}).\nDeposit funds then tap \"✅ Confirm\" again:\n{link}",
  },
  adDepositThenConfirm: { ar: "بعد الإيداع اضغط «✅ تأكيد الإرسال» مجدداً لإطلاق حملتك.", en: "After depositing, tap \"✅ Confirm\" again to launch your campaign." },
  adLaunched: { ar: "تم إطلاق حملتك (خُصم {budget}). ستظهر الآن في «شاهد واربح» لكل المستخدمين.", en: "Your campaign is live (charged {budget}). It now appears in \"Watch & Earn\" for every user." },

  watchNoAds: { ar: "لا حملات متاحة على هذه المنصة حالياً.", en: "No campaigns available on this platform right now." },
  watchForcedLabel: { ar: "🌟 عرض من المنصة", en: "🌟 Platform promotion" },
  watchAdLabel: { ar: "{platform}\nالمكافأة: {reward}", en: "{platform}\nReward: {reward}" },
  watchLinkLine: { ar: "\nالرابط: {link}", en: "\nLink: {link}" },
  watchConfirmLine: { ar: "\nللتأكيد بعد إتمام المهمة، اضغط الزر: ✅ {id}", en: "\nTo confirm after completing the task, tap: ✅ {id}" },
  watchTapConfirm: { ar: "اضغط زر التأكيد المطابق بعد إتمام المهمة:", en: "Tap the matching confirm button after completing the task:" },
  watchBackOnly: { ar: "للرجوع:", en: "Back to menu:" },

  taskGone: { ar: "هذه المهمة لم تعد متاحة.", en: "This task is no longer available." },
  taskOwnCampaign: { ar: "لا يمكنك إتمام حملتك الخاصة.", en: "You can't complete your own campaign." },
  taskNotJoined: { ar: "لم يتم التحقق من انضمامك بعد إلى {channel}. انضم ثم أعد المحاولة.", en: "Couldn't verify you've joined {channel} yet. Join then try again." },
  taskVerifyFailed: { ar: "تعذّر التحقق من العضوية. تأكد أن رابط القناة صحيح وأن البوت مشرف فيها.", en: "Couldn't verify membership. Make sure the channel link is correct and the bot is an admin there." },
  taskAlreadyClaimed: { ar: "استفدت من هذه المهمة مسبقاً.", en: "You've already claimed this task." },
  taskRewarded: { ar: "أُضيف {amount}! رصيدك الآن: {balance}.", en: "{amount} added! Your balance is now: {balance}." },

  statsTitle: {
    ar: "📊 إحصائياتك:\nحملات أنشأتها: {ads}\nإجمالي الصرف: {spent}\nمهام أتممتها: {tasks}\nإجمالي أرباحك: {earned}",
    en: "📊 Your stats:\nCampaigns created: {ads}\nTotal spent: {spent}\nTasks completed: {tasks}\nTotal earned: {earned}",
  },
  earningsGate: { ar: "هذا القسم مخصَّص لمنشئ البوت فقط.", en: "This section is for the bot's creator only." },
  earningsBody: { ar: "💼 أرباحك كمنشئ هذا البوت: {balance}\n(20% من كل نقرة مكتملة على حملات هذا البوت)", en: "💼 Your earnings as this bot's creator: {balance}\n(20% of every completed click on this bot's campaigns)" },

  depositChoose: { ar: "اختر مبلغ الإيداع وعملتك المفضّلة (USDT, TRX, TON, LTC, SOL...) في الصفحة:\n{link}", en: "Choose your deposit amount and preferred currency (USDT, TRX, TON, LTC, SOL...) on the page:\n{link}" },
};

export function t(lang: Lang, key: keyof typeof STR, vars?: Record<string, string | number>): string {
  let s = STR[key]?.[lang] ?? STR[key]?.ar ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
