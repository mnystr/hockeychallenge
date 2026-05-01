import { BUCKET } from "./upload";

/**
 * Build a public URL for a Storage path without needing a Supabase client
 * instance — useful in server components where we don't want an extra
 * round-trip just to read the configured URL.
 */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const clean = path.replace(/^\/+/, "");
  // Dev: emit a relative path so the browser hits the Next.js origin, which
  // rewrites `/_supabase/*` to the configured Supabase URL (see
  // next.config.ts). This way LAN devices can load Storage assets even when
  // Supabase is bound to 127.0.0.1 on the host.
  if (process.env.NODE_ENV !== "production") {
    return `/_supabase/storage/v1/object/public/${BUCKET}/${clean}`;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${clean}`;
}
