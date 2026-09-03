"use client";

import { useState } from "react";

type Edu = { school: string; degree: string; year: string };
type Exp = { company: string; role: string; period: string; desc: string };

const emptyEdu = (): Edu => ({ school: "", degree: "", year: "" });
const emptyExp = (): Exp => ({ company: "", role: "", period: "", desc: "" });

export default function CvGenerator() {
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [summary, setSummary] = useState("");
  const [education, setEducation] = useState<Edu[]>([emptyEdu()]);
  const [experience, setExperience] = useState<Exp[]>([emptyExp()]);
  const [skills, setSkills] = useState("");
  const [languages, setLanguages] = useState("");

  function updateEdu(i: number, field: keyof Edu, val: string) {
    setEducation((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));
  }
  function updateExp(i: number, field: keyof Exp, val: string) {
    setExperience((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));
  }

  function handlePrint() {
    window.print();
  }

  const skillList = skills
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const langList = languages
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hasContent = name.trim() || jobTitle.trim();

  return (
    <div className="space-y-8">
      {/* Form — hidden on print */}
      <div className="print:hidden rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-900">بيانات السيرة الذاتية</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">الاسم الكامل *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أحمد محمد العلي"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">المسمى الوظيفي</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="مثال: مطور برمجيات / محاسب"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">رقم الجوال</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966 5xxxxxxxx"
              dir="ltr"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">البريد الإلكتروني</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">المدينة / الدولة</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="الرياض، السعودية"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">نبذة مختصرة</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="ملخص قصير عن خبرتك وأهدافك المهنية..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Education */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">التعليم</label>
            <button
              type="button"
              onClick={() => setEducation((p) => [...p, emptyEdu()])}
              className="text-xs font-bold text-brand-600 hover:underline"
            >
              + إضافة
            </button>
          </div>
          {education.map((edu, i) => (
            <div key={i} className="mb-3 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-3">
              <input
                value={edu.school}
                onChange={(e) => updateEdu(i, "school", e.target.value)}
                placeholder="الجامعة / المعهد"
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                value={edu.degree}
                onChange={(e) => updateEdu(i, "degree", e.target.value)}
                placeholder="التخصص / الدرجة"
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <input
                  value={edu.year}
                  onChange={(e) => updateEdu(i, "year", e.target.value)}
                  placeholder="السنة"
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                {education.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEducation((p) => p.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-500"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Experience */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">الخبرات العملية</label>
            <button
              type="button"
              onClick={() => setExperience((p) => [...p, emptyExp()])}
              className="text-xs font-bold text-brand-600 hover:underline"
            >
              + إضافة
            </button>
          </div>
          {experience.map((exp, i) => (
            <div key={i} className="mb-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={exp.company}
                  onChange={(e) => updateExp(i, "company", e.target.value)}
                  placeholder="الشركة / الجهة"
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  value={exp.role}
                  onChange={(e) => updateExp(i, "role", e.target.value)}
                  placeholder="المسمى"
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    value={exp.period}
                    onChange={(e) => updateExp(i, "period", e.target.value)}
                    placeholder="2020 — 2023"
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  {experience.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExperience((p) => p.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-500"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={exp.desc}
                onChange={(e) => updateExp(i, "desc", e.target.value)}
                rows={2}
                placeholder="وصف مختصر للمهام والإنجازات"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">المهارات (افصل بفاصلة)</label>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              rows={2}
              placeholder="إدارة مشاريع، Excel، تفاوض، React"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">اللغات (افصل بفاصلة)</label>
            <textarea
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              rows={2}
              placeholder="العربية (أم)، الإنجليزية (متقدم)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          disabled={!hasContent}
          className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:bg-slate-300"
        >
          🖨️ اطبع / احفظ كـ PDF
        </button>
        <p className="text-xs text-slate-400 text-center">
          سيفتح مربع الطباعة في متصفحك — اختر «حفظ كـ PDF» أو الطابعة. النص العربي يُعرض بشكل صحيح بفضل محرك المتصفح.
        </p>
      </div>

      {/* Live preview + print target */}
      <div
        id="cv-print-area"
        dir="rtl"
        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none print:p-0"
      >
        <header className="border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">{name || "الاسم الكامل"}</h1>
          {jobTitle && <p className="mt-1 text-lg text-brand-700 font-semibold">{jobTitle}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {phone && <span dir="ltr">{phone}</span>}
            {email && <span dir="ltr">{email}</span>}
            {city && <span>{city}</span>}
          </div>
        </header>

        {summary.trim() && (
          <section className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-200 pb-1">
              نبذة
            </h2>
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{summary}</p>
          </section>
        )}

        {experience.some((e) => e.company || e.role) && (
          <section className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-200 pb-1">
              الخبرات العملية
            </h2>
            <div className="space-y-4">
              {experience
                .filter((e) => e.company || e.role)
                .map((exp, i) => (
                  <div key={i}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        {exp.role}
                        {exp.company ? ` — ${exp.company}` : ""}
                      </p>
                      {exp.period && <span className="text-xs text-slate-500">{exp.period}</span>}
                    </div>
                    {exp.desc && (
                      <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{exp.desc}</p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {education.some((e) => e.school || e.degree) && (
          <section className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-200 pb-1">
              التعليم
            </h2>
            <div className="space-y-3">
              {education
                .filter((e) => e.school || e.degree)
                .map((edu, i) => (
                  <div key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-slate-900">
                      {edu.degree}
                      {edu.school ? ` — ${edu.school}` : ""}
                    </p>
                    {edu.year && <span className="text-xs text-slate-500">{edu.year}</span>}
                  </div>
                ))}
            </div>
          </section>
        )}

        {skillList.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-200 pb-1">
              المهارات
            </h2>
            <div className="flex flex-wrap gap-2">
              {skillList.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {langList.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2 border-b border-slate-200 pb-1">
              اللغات
            </h2>
            <p className="text-sm text-slate-800">{langList.join(" · ")}</p>
          </section>
        )}

        {!hasContent && (
          <p className="text-center text-sm text-slate-400 py-12">
            املأ الاسم على الأقل لترى المعاينة هنا.
          </p>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #cv-print-area,
          #cv-print-area * {
            visibility: visible;
          }
          #cv-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 1.5cm;
            box-shadow: none;
            border: none;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
