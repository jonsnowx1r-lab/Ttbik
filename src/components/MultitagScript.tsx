"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

// Monetag Multitag (zone 275749) bundles several ad formats automatically,
// including more intrusive ones (popunder/interstitial) alongside banners —
// unlike the single-format In-Page Push script, which stays site-wide.
// Kept off these paths so it never interrupts a real money/credential flow:
// checkout & order tracking, wallet/payment pages, the admin dashboard, the
// bot-token deploy form, and the ad-watch verification page (an ad breaking
// another ad's reward flow would be a bad look).
const EXCLUDED_PREFIXES = ["/admin", "/order", "/pay", "/bots", "/watch"];

export default function MultitagScript() {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return <Script src="https://quge5.com/88/tag.min.js" data-zone="275749" strategy="afterInteractive" data-cfasync="false" />;
}
