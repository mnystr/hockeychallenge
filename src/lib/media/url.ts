import { BUCKET } from "./upload";

/**
 * Build a public URL for a Storage path without needing a Supabase client
 * instance — useful in server components where we don't want an extra
 * round-trip just to read the configured URL.
 */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = path.replace(/^\/+/, "");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${clean}`;
}
