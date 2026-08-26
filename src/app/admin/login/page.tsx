"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.trim() }),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("كلمة المرور غير صحيحة");
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <h1 className="mb-6 text-center text-xl font-extrabold text-slate-900">لوحة تحكم الإدارة</h1>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="كلمة المرور"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 pl-16 text-sm focus:border-brand-500 focus:outline-none"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-600"
        >
          {showPassword ? "إخفاء" : "إظهار"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        className="mt-4 w-full rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
      >
        دخول
      </button>
    </div>
  );
}
