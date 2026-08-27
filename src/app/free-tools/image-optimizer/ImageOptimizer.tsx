"use client";

import { useRef, useState } from "react";

type Format = "image/webp" | "image/jpeg" | "image/png";

const FORMATS: { value: Format; label: string; ext: string }[] = [
  { value: "image/webp", label: "WebP (الأفضل — أصغر حجم)", ext: "webp" },
  { value: "image/jpeg", label: "JPEG", ext: "jpg" },
  { value: "image/png", label: "PNG (بلا فقدان جودة)", ext: "png" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}

export default function ImageOptimizer() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("image/webp");
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; size: number; ext: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setResult(null);
  }

  function convert() {
    if (!file) return;
    setIsProcessing(true);

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let { width, height } = img;
      const limit = parseInt(maxWidth, 10);
      if (limit > 0 && width > limit) {
        height = Math.round((height * limit) / width);
        width = limit;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const ext = FORMATS.find((f) => f.value === format)!.ext;
          setResult({ url, size: blob.size, ext });
        },
        format,
        format === "image/png" ? undefined : quality
      );
    };
  }

  const savedPct = result && file ? Math.max(0, Math.round((1 - result.size / file.size) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center">
        <input
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleUpload}
          className="text-sm"
        />
        {file && (
          <p className="mt-2 text-sm text-slate-500">
            {file.name} — {formatBytes(file.size)}
          </p>
        )}
      </div>

      {file && (
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">الصيغة الناتجة</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {format !== "image/png" && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                الجودة ({Math.round(quality * 100)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              أقصى عرض بالبكسل (اختياري — لتصغير الأبعاد أيضاً)
            </label>
            <input
              type="number"
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              placeholder="مثال: 1200"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              dir="ltr"
            />
          </div>

          <button
            onClick={convert}
            disabled={isProcessing}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:bg-slate-300"
          >
            {isProcessing ? "جاري المعالجة..." : "تحويل وضغط الآن"}
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {result && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="mb-3 font-bold text-slate-900">
            تم! الحجم الجديد {formatBytes(result.size)}
            {savedPct > 0 && <span className="text-emerald-600"> (توفير {savedPct}%)</span>}
          </p>
          <img src={result.url} alt="النتيجة" className="mx-auto max-h-64 max-w-full rounded-lg" />
          <a
            href={result.url}
            download={`${file?.name.split(".")[0] || "image"}-optimized.${result.ext}`}
            className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            تنزيل الصورة الناتجة
          </a>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        كل المعالجة تتم داخل متصفحك مباشرة — صورك لا تُرفع لأي خادم ولا نراها إطلاقاً.
      </p>
    </div>
  );
}
