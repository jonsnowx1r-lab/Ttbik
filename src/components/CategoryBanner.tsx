const THEMES: Record<string, { gradient: string; blob: string }> = {
  "telegram-bots": {
    gradient: "from-indigo-500 to-violet-600",
    blob: "🤖",
  },
  "ai-translation": {
    gradient: "from-sky-500 to-blue-600",
    blob: "🌐",
  },
  "automation-sites": {
    gradient: "from-amber-500 to-orange-600",
    blob: "⚙️",
  },
  "content-design": {
    gradient: "from-rose-500 to-pink-600",
    blob: "🎨",
  },
};

const DEFAULT_THEME = { gradient: "from-brand-500 to-brand-700", blob: "🧰" };

/**
 * A colorful, distinct visual cover per category — no external images or
 * paid assets, just gradients + layered decorative shapes, so each section
 * of the storefront feels designed rather than a plain text list.
 */
export default function CategoryBanner({ slug, icon }: { slug: string; icon: string }) {
  const theme = THEMES[slug] ?? DEFAULT_THEME;

  return (
    <div
      className={`relative flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} sm:h-32`}
    >
      <div className="pointer-events-none absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-white/10" />
      <span className="relative text-5xl drop-shadow sm:text-6xl" aria-hidden>
        {icon || theme.blob}
      </span>
    </div>
  );
}
