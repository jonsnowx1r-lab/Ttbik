import { ImageResponse } from "next/og";

// Social share preview (WhatsApp/Telegram/Twitter link cards) — the site
// had zero Open Graph metadata before this SEO pass, so every shared link
// showed no image and a generic browser-chosen title, which quietly kills
// click-through on exactly the sharing channels this audience uses most.
//
// Satori (the renderer behind ImageResponse) does not ship Arabic glyphs
// or shaping in its default fallback font — Arabic text drawn without an
// explicit Arabic font renders as disconnected letters or tofu boxes, the
// same class of bug already caught in Grok's CV/PDF generator this
// session. Cairo (a proper Arabic OpenType font) is fetched at request
// time and passed to ImageResponse's `fonts` option, which is Satori's
// documented, supported path for correct Arabic shaping + RTL. If that
// fetch ever fails (offline build, Google Fonts unreachable), the catch
// falls back to a logo-only card with no Arabic text — never a broken-
// looking share image.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadCairoFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Cairo:wght@800", {
      headers: {
        // Google Fonts serves TTF only to older/basic user agents — modern
        // browsers get WOFF2, which Satori cannot parse.
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.111 Safari/537.36",
      },
    }).then((res) => res.text());
    const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    return await fetch(match[1]).then((res) => res.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const cairo = await loadCairoFont();
  const brandMark = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 140,
        height: 140,
        borderRadius: 32,
        background: "rgba(255,255,255,0.15)",
        marginBottom: 36,
      }}
    >
      <svg width="84" height="84" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 15.5 14.8 8.7a1.6 1.6 0 0 1 2.3 2.3L10.3 17.8a1.9 1.9 0 0 1-1.3.55H7v-2a1.9 1.9 0 0 1 .55-1.33Z"
          stroke="white"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M13 10.5l2.3 2.3" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );
  const background = "linear-gradient(135deg, #0369a1 0%, #0284c7 55%, #0ea5e9 100%)";

  if (!cairo) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background }}>
          {brandMark}
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        dir="rtl"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background,
          fontFamily: "Cairo",
        }}
      >
        {brandMark}
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "white" }}>سوق تولز</div>
        <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.9)", marginTop: 18 }}>
          سوق الخدمات والأدوات الرقمية المصغّرة
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Cairo", data: cairo, weight: 800, style: "normal" }] }
  );
}
