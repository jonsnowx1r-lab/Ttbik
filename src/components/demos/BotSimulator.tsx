"use client";

import { useState } from "react";

interface Msg {
  from: "user" | "bot";
  text: string;
}

/**
 * Fully client-side Telegram-bot simulator — mimics how the purchased bot
 * would reply, without needing a real bot token. Zero backend cost.
 */
export default function BotSimulator({ botName }: { botName: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { from: "bot", text: `مرحباً بك! أنا ${botName} 🤖 جرّب اكتب سؤالك (مثال: السعر، مواعيد العمل، شحن).` },
  ]);
  const [input, setInput] = useState("");

  function reply(text: string): string {
    const t = text.toLowerCase();
    if (t.includes("سعر") || t.includes("price")) return "أسعارنا تبدأ من 5$ فقط، تحقق من صفحة الخدمة للتفاصيل الكاملة.";
    if (t.includes("مواعيد") || t.includes("وقت")) return "نستقبل طلباتك على مدار 24 ساعة، والموافقة تتم خلال دقائق.";
    if (t.includes("شحن") || t.includes("توصيل")) return "التسليم رقمي وفوري فور الموافقة على الدفع، لا يوجد شحن فعلي.";
    if (t.includes("مرحبا") || t.includes("اهلا") || t.includes("السلام")) return "أهلاً بك! كيف أقدر أساعدك اليوم؟";
    return "شكراً لتواصلك! سيتم تحويل استفسارك لفريق الدعم والرد عليك قريباً.";
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    const botReply = reply(text);
    setMessages((m) => [...m, { from: "user", text }, { from: "bot", text: botReply }]);
    setInput("");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-xs font-semibold text-brand-700">محاكاة تفاعلية لسلوك البوت داخل تليجرام</p>
      <div className="h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.from === "bot"
                ? "bg-white text-slate-700 shadow-sm"
                : "mr-auto bg-brand-600 text-white"
            }`}
            style={{ marginInlineStart: m.from === "user" ? "auto" : 0 }}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="اكتب رسالتك للبوت..."
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={send}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          إرسال
        </button>
      </div>
    </div>
  );
}
