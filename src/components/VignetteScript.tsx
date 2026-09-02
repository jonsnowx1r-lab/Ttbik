"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

// Monetag Vignette (zone 11710169) — a full-page interstitial shown between
// navigations. The most conversion-damaging format offered, so it's kept
// off the same money/credential/ad-verification paths as Multitag.
const EXCLUDED_PREFIXES = ["/admin", "/order", "/pay", "/bots", "/watch"];

export default function VignetteScript() {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return (
    <Script
      id="monetag-vignette"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html:
          "(function(s){s.dataset.zone='11710169',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))",
      }}
    />
  );
}
