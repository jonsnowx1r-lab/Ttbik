import type { Metadata } from "next";

// Deposit pages are per-user (?uid=...), transactional, and have zero SEO
// value — indexing them would also mean a user id could theoretically
// surface in a search result snippet. Covers /pay, /pay/marriage,
// /pay/jobs from this one file.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
