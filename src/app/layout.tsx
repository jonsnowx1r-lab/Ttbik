import type { Metadata } from "next";
import "./globals.css";
import Logo from "@/components/Logo";
import { isOwnerServer } from "@/lib/isOwner";

export const metadata: Metadata = {
  title: "سوق تولز — سوق الخدمات الرقمية المصغّرة",
  description:
    "سوق تولز: منصة لبيع خدمات وأدوات رقمية جاهزة (بوتات، أدوات ذكاء اصطناعي، أتمتة) بأسعار رمزية وتسليم فوري.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isOwner = isOwnerServer();

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
        {isOwner && (
          <div className="bg-emerald-600 py-1.5 text-center text-xs font-bold text-white">
            🔑 وضع المالك مفعّل — لديك وصول كامل لكل الخدمات والأدوات
          </div>
        )}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
            <a href="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold text-brand-800">
              <Logo className="h-7 w-7" /> سوق تولز
            </a>
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm font-semibold text-slate-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <a href="/#categories" className="rounded-full px-3 py-1.5 transition hover:bg-brand-50 hover:text-brand-700">
                الأقسام
              </a>
              <a href="/how-it-works" className="rounded-full px-3 py-1.5 transition hover:bg-brand-50 hover:text-brand-700">
                كيف يعمل الموقع؟
              </a>
              <a
                href="/free-tools"
                className="rounded-full px-3 py-1.5 text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                🎁 أدوات مجانية
              </a>
              <a href="/order/lookup" className="rounded-full px-3 py-1.5 transition hover:bg-brand-50 hover:text-brand-700">
                تتبع طلبي
              </a>
              <a
                href="/admin"
                className="mr-1 shrink-0 rounded-full bg-brand-700 px-3.5 py-1.5 text-white transition hover:bg-brand-800"
              >
                {isOwner ? "لوحة التحكم" : "دخول المالك"}
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-20 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-right">
              <a href="/" className="flex items-center gap-2 text-base font-extrabold text-brand-800">
                <Logo className="h-6 w-6" /> سوق تولز
              </a>
              <p className="text-sm text-slate-500">
                💳 تحويل بنكي · USDT &nbsp;·&nbsp; ⚡ تسليم فوري بعد الموافقة &nbsp;·&nbsp; 💬 دعم عبر تليجرام
              </p>
            </div>
            <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
              <p>© {new Date().getFullYear()} سوق تولز — جميع الحقوق محفوظة.</p>
              <p className="flex items-center gap-4">
                <a href="/terms" className="hover:text-brand-700">الشروط وسياسة الاسترجاع</a>
                <a href="/privacy" className="hover:text-brand-700">سياسة الخصوصية</a>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
