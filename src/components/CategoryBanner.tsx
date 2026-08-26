const THEMES: Record<string, { gradient: string; Icon: (props: { className?: string }) => JSX.Element }> = {
  "telegram-bots": { gradient: "from-indigo-500 to-violet-600", Icon: BotIcon },
  "ai-translation": { gradient: "from-sky-500 to-blue-600", Icon: TranslateIcon },
  "automation-sites": { gradient: "from-amber-500 to-orange-600", Icon: AutomationIcon },
  "content-design": { gradient: "from-rose-500 to-pink-600", Icon: ContentIcon },
};

const DEFAULT_THEME = { gradient: "from-brand-500 to-brand-700", Icon: ToolboxIcon };

/** Small inline icon for a category (used in the quick-jump pill nav). */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = (THEMES[slug] ?? DEFAULT_THEME).Icon;
  return <Icon className={className} />;
}

/**
 * A colorful, distinct visual cover per category using clean custom-drawn
 * SVG icons (not emoji, which render inconsistently — sometimes cartoonish
 * — across devices/OSes). No external images, no cost, no network
 * dependency, consistent look for every visitor.
 */
export default function CategoryBanner({ slug }: { slug: string }) {
  const theme = THEMES[slug] ?? DEFAULT_THEME;
  const Icon = theme.Icon;

  return (
    <div
      className={`relative flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} sm:h-32`}
    >
      <div className="pointer-events-none absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-white/10" />
      <Icon className="relative h-12 w-12 text-white drop-shadow sm:h-14 sm:w-14" />
    </div>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V5M9 5h6" strokeLinecap="round" />
      <circle cx="9" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9 16.5h6" strokeLinecap="round" />
      <path d="M2 12h2M20 12h2" strokeLinecap="round" />
    </svg>
  );
}

function TranslateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h8M8 4v2c0 4-2 7-5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9c1 1.6 3 3 6 3.5" strokeLinecap="round" />
      <path d="M14 20l4-9 4 9M15.4 17h5.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AutomationIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.3 6.3l1.6 1.6M16.1 16.1l1.6 1.6M6.3 17.7l1.6-1.6M16.1 7.9l1.6-1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ContentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="4" width="12" height="16" rx="2" />
      <path d="M8.5 8.5h5M8.5 12h5M8.5 15.5h3" strokeLinecap="round" />
      <path d="M16.5 15.5l3-3 1.5 1.5-3 3H16.5v-1.5z" strokeLinejoin="round" />
    </svg>
  );
}

function ToolboxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="9" width="18" height="10" rx="2" />
      <path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" />
      <path d="M3 13h18M11 13v2M13 13v2" strokeLinecap="round" />
    </svg>
  );
}
