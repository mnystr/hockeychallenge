import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server actions cap request bodies at 1 MB by default. Phone-camera
    // JPEGs are routinely 5–10 MB before our sharp pipeline downscales
    // them, so the upload was rejected before our 15 MB validator ran.
    // Match the validator in src/lib/media/upload.ts.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  // When running `npm run dev:lan` (next dev -H 0.0.0.0) we want phones
  // and tablets on the same Wi-Fi to reach http://<host-ip>:3000. Next 16
  // gates dev assets behind an origin allowlist; whitelist private LAN
  // ranges so cross-origin requests from those devices aren't refused.
  // localhost / 127.0.0.1 work without this — `npm run dev` is unchanged.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
  // Dev only: proxy `/_supabase/*` through the Next.js dev server to the
  // configured Supabase URL. This lets phones on the LAN load Storage assets
  // even when Supabase is bound to 127.0.0.1, since the browser fetches via
  // the dev server's LAN-reachable origin and `publicMediaUrl` emits a
  // relative path. In production we fall through to direct Supabase URLs.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
    if (!base) return [];
    return [
      { source: "/_supabase/:path*", destination: `${base}/:path*` },
    ];
  },
};

export default nextConfig;
