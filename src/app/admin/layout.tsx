import type { Metadata } from "next";

// The whole /admin subtree is a private control panel — it was never
// excluded from indexing (only disallowed in robots.txt, which stops
// crawling but does NOT stop a URL already linked from elsewhere getting
// indexed with a bare title/no snippet). A noindex meta tag is the
// correct belt-and-suspenders fix, and covers every current and future
// page under /admin from this one file.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
