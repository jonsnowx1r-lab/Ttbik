import type { Metadata } from "next";
import "./globals.css";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "سوق تولز — سوق الخدمات الرقمية المصغّرة",
  description:
    "سوق تولز: منصة لبيع خدمات وأدوات رقمية جاهزة (بوتات، أدوات ذكاء اصطناعي، أتمتة) بأسعار رمزية وتسليم فوري.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen font-sans text-slate-800 antialiased">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-2 text-lg font-extrabold text-brand-700">
              <Logo className="h-7 w-7" /> سوق تولز
            </a>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <a href="/#categories" className="hover:text-brand-700">الأقسام</a>
              <a href="/free-tools" className="font-semibold text-emerald-600 hover:text-emerald-700">
                🎁 أدوات مجانية
              </a>
              <a href="/order/lookup" className="hover:text-brand-700">تتبع طلبي</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} سوق تولز — جميع الحقوق محفوظة.</p>
          <p className="mt-2 flex items-center justify-center gap-4">
            <a href="/terms" className="hover:text-brand-700">الشروط وسياسة الاسترجاع</a>
            <a href="/privacy" className="hover:text-brand-700">سياسة الخصوصية</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
