import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1e3a8a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          HC
        </div>
        <div
          style={{
            width: 44,
            height: 8,
            background: "#f59e0b",
            borderRadius: 4,
            marginTop: 12,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
