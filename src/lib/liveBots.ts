// Real, live Telegram bots the owner runs — single source of truth for
// the free-tools page, the homepage, and the telegram-post promo cron, so
// a new bot (or a change to one) only needs to be added here once.
export const LIVE_BOTS = [
  {
    href: "https://t.me/Saragptbotbot",
    title: "بوت فرص العمل والمتجر",
    desc: "بوابتك الشاملة لإيجاد فرص العمل والوظائف اليومية، واستعراض أفضل المنتجات والعروض الحصرية.",
  },
  {
    href: "https://t.me/Saragptbot",
    title: "بوت التعارف والزواج الشرعي",
    desc: "هنا تلتقي الأرواح الطيبة.. خطوتك الأولى لإيجاد الشريك للزواج الشرعي وتكوين الصداقات.",
  },
  {
    href: "https://t.me/AdsClicsBot?start=8144671083",
    title: "بوت الإعلانات والمهام",
    desc: "أنشئ إعلانك وحدد الميزانية والسعر، أو ابدأ الربح من مشاهدة الإعلانات.",
  },
] as const;
