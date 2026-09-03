import type { Metadata } from "next";

// Per-token, single-use ad-watch verification pages — indexing thousands
// of throwaway /watch/[token] URLs would be pure duplicate/thin content
// with zero search value.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
