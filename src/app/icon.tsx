import { ImageResponse } from "next/og";

// Site favicon — the repo had none at all (no favicon.ico, no public icon,
// no App Router icon.tsx), which hurts trust/CTR in search results and
// browser tabs alike. Rendered dynamically to match Logo.tsx exactly
// instead of shipping a separate binary asset that could drift from it.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0284c7",
          borderRadius: 8,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 15.5 14.8 8.7a1.6 1.6 0 0 1 2.3 2.3L10.3 17.8a1.9 1.9 0 0 1-1.3.55H7v-2a1.9 1.9 0 0 1 .55-1.33Z"
            stroke="white"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M13 10.5l2.3 2.3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
