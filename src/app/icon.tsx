import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          HC
        </div>
        <div
          style={{
            width: 14,
            height: 3,
            background: "#f59e0b",
            borderRadius: 2,
            marginTop: 4,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
