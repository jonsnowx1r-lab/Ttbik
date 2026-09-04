// Single shared constant for the site's canonical base URL — used by pages
// that need to build absolute URLs (hreflang alternates, sitemap entries)
// instead of each repeating the same env-var + fallback + trailing-slash-
// strip logic.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "");
