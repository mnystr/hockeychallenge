import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — server-only. Bypasses RLS. Use for storage writes
 * (after validating auth via `createClient()` from ./server.ts first) and
 * for admin operations on auth schema.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY (or URL) not configured");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
