"use client";

import AdsterraBanner from "./AdsterraBanner";

// Adsterra ad-unit keys (site: ttbik.vercel.app, added 2026-09-04).
const KEY_320x50 = "560a1eb1632771185b888243a7d36a07";
const KEY_300x250 = "3ee970813986977775e962f26938d143";
const KEY_728x90 = "4f06d38f318a4c96638f8e2289f8ca0c";

/**
 * Renders the right Adsterra unit for a given AdSlot position.
 * header-banner/footer-banner are responsive: a slim 320x50 on mobile
 * (most of this site's traffic — shared Telegram/WhatsApp links open on
 * phones) and the wider 728x90 from `sm:` up, so a fixed 728px-wide
 * iframe never overflows a ~360-400px mobile viewport. in-content uses
 * the 300x250 rectangle — Adsterra's highest-demand size, and safe to
 * repeat on pages that place two in-content slots (each AdsterraBanner is
 * its own isolated iframe, so there's no id collision like the Native
 * Banner has — see AdsterraNative.tsx).
 */
export default function AdsterraSlot({ position }: { position: "header-banner" | "in-content" | "footer-banner" }) {
  if (position === "in-content") {
    return (
      <div className="flex justify-center">
        <AdsterraBanner adKey={KEY_300x250} width={300} height={250} />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="sm:hidden">
        <AdsterraBanner adKey={KEY_320x50} width={320} height={50} />
      </div>
      <div className="hidden sm:block">
        <AdsterraBanner adKey={KEY_728x90} width={728} height={90} />
      </div>
    </div>
  );
}
