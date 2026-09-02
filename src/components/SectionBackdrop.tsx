import { getCategoryTheme } from "@/lib/categoryTheme";

/**
 * Per-section decorative background — soft, blurred gradient blobs tinted
 * to the page's category color, instead of a stock photo. Same reasoning
 * CategoryBanner already used for its icons: no external image file to
 * source, license, host, or keep in sync with a redesign, and it never
 * slows the page down or looks mismatched on a random visitor's screen.
 * Purely decorative — absolutely positioned, behind content, pointer-events
 * disabled — so it never affects layout or scroll.
 */
export default function SectionBackdrop({ tone }: { tone?: string | null }) {
  const theme = getCategoryTheme(tone);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
      <div
        className="absolute -top-32 right-[-10%] h-80 w-80 rounded-full blur-3xl sm:h-96 sm:w-96"
        style={{ background: theme.blob }}
      />
      <div
        className="absolute -top-16 left-[-15%] h-72 w-72 rounded-full blur-3xl sm:h-80 sm:w-80"
        style={{ background: theme.blob }}
      />
    </div>
  );
}
