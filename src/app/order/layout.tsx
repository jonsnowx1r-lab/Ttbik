import type { Metadata } from "next";

// Per-customer order-tracking pages — thin, private, no SEO value, and an
// indexed /order/[code] page could leak an order's existence via search.
// Covers /order/[code] and /order/lookup from this one file.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
