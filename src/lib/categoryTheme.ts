/**
 * Single source of truth for "what color is this section" across the
 * whole site — sidebar tabs, service-card badges, order buttons, and the
 * decorative page backdrops (see SectionBackdrop) all read from here
 * instead of each hardcoding its own brand-blue, so a category always
 * looks the same shade everywhere a visitor sees it. Keyed by DB category
 * slug where one exists, plus two site sections that aren't DB categories
 * but still need a consistent identity: "free-tools" (the emerald "مجاني"
 * color already used site-wide) and "bots" (AD_BOT/MARRIAGE_BOT creation,
 * which lives conceptually under telegram-bots).
 */
export type CategoryTheme = {
  /** Banner/backdrop gradient — Tailwind "from-x-500 to-y-600". */
  gradient: string;
  /** Solid button — bg + hover, white text. */
  button: string;
  /** Light pill/badge background. */
  badgeBg: string;
  /** Text color matching badgeBg. */
  badgeText: string;
  /** Full literal "group-hover:text-x-700" — Tailwind's scanner needs the
   *  complete class string somewhere in source; composing "group-hover:" +
   *  badgeText at runtime would never get generated. */
  groupHoverText: string;
  /** Active sidebar-tab / selected-pill background. */
  activeTab: string;
  /** Border color for cards/inputs in this theme. */
  border: string;
  /** Blob tint used by SectionBackdrop (rgba, low alpha). */
  blob: string;
};

const THEMES: Record<string, CategoryTheme> = {
  "telegram-bots": {
    gradient: "from-indigo-500 to-violet-600",
    button: "bg-indigo-700 hover:bg-indigo-800",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    groupHoverText: "group-hover:text-indigo-700",
    activeTab: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
    blob: "rgba(99,102,241,0.18)",
  },
  bots: {
    gradient: "from-indigo-500 to-violet-600",
    button: "bg-indigo-700 hover:bg-indigo-800",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    groupHoverText: "group-hover:text-indigo-700",
    activeTab: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
    blob: "rgba(99,102,241,0.18)",
  },
  "creative-studio": {
    gradient: "from-teal-500 to-cyan-600",
    button: "bg-teal-700 hover:bg-teal-800",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    groupHoverText: "group-hover:text-teal-700",
    activeTab: "bg-teal-50 text-teal-700",
    border: "border-teal-200",
    blob: "rgba(20,184,166,0.18)",
  },
  "free-tools": {
    gradient: "from-emerald-500 to-green-600",
    button: "bg-emerald-700 hover:bg-emerald-800",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    groupHoverText: "group-hover:text-emerald-700",
    activeTab: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
    blob: "rgba(16,185,129,0.18)",
  },
  "ai-translation": {
    gradient: "from-sky-500 to-blue-600",
    button: "bg-sky-700 hover:bg-sky-800",
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-700",
    groupHoverText: "group-hover:text-sky-700",
    activeTab: "bg-sky-50 text-sky-700",
    border: "border-sky-200",
    blob: "rgba(14,165,233,0.18)",
  },
  "content-design": {
    gradient: "from-rose-500 to-pink-600",
    button: "bg-rose-700 hover:bg-rose-800",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    groupHoverText: "group-hover:text-rose-700",
    activeTab: "bg-rose-50 text-rose-700",
    border: "border-rose-200",
    blob: "rgba(244,63,94,0.18)",
  },
};

const DEFAULT_THEME: CategoryTheme = {
  gradient: "from-brand-500 to-brand-700",
  button: "bg-brand-700 hover:bg-brand-800",
  badgeBg: "bg-brand-50",
  badgeText: "text-brand-700",
  groupHoverText: "group-hover:text-brand-700",
  activeTab: "bg-brand-50 text-brand-700",
  border: "border-brand-200",
  blob: "rgba(14,165,233,0.16)",
};

export function getCategoryTheme(slug: string | null | undefined): CategoryTheme {
  return (slug && THEMES[slug]) || DEFAULT_THEME;
}
