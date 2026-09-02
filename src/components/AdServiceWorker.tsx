"use client";

import { useEffect } from "react";

/**
 * Registers the ad network's service worker (public/sw_1.js — 3nbf4.com
 * domain-ownership + push-ad verification file) once per visit. Silently
 * no-ops if the browser doesn't support service workers.
 */
export default function AdServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw_1.js").catch(() => {
        // ad network unreachable/blocked — not fatal to the rest of the site
      });
    }
  }, []);
  return null;
}
