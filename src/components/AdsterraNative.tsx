"use client";

import { useEffect } from "react";

// Adsterra Native Banner — a real script + a container div it targets by
// this specific id (baked into the ad-unit's own invoke.js on Adsterra's
// side, not something this app can rename). That means this exact unit can
// only safely appear ONCE per page — two copies would create two elements
// with the same id, and the script would only ever fill the first. Render
// this only from a single call site per page (currently: the free-tools
// listing page), never through the reusable multi-instance AdSlot.
const CONTAINER_ID = "container-be014aa42eb5b3deff3b8d41960fa006";
const SCRIPT_ID = "adsterra-native-script";
const SCRIPT_SRC = "https://pl31153917.profitableratecpmnetwork.com/be014aa42eb5b3deff3b8d41960fa006/invoke.js";

let injected = false;

export default function AdsterraNative() {
  useEffect(() => {
    if (injected || document.getElementById(SCRIPT_ID)) return;
    injected = true;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = SCRIPT_SRC;
    document.body.appendChild(script);
  }, []);

  return <div id={CONTAINER_ID} />;
}
