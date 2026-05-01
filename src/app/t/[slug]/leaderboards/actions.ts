"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOvertakes, snapshotStandings } from "@/lib/leaderboards/overtake";
import {
  standaloneEntrySchema,
  type StandaloneEntryFormState,
} from "@/lib/auth/schemas-leaderboards";

export async function submitStandaloneEntry(
  slug: string,
  leaderboardId: string,
  _state: StandaloneEntryFormState,
  formData: FormData,
): Promise<StandaloneEntryFormState> {
  const parsed = standaloneEntrySchema.safeParse({
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Not authenticated." };

  const { data: board } = await supabase
    .from("leaderboards")
    .select("team_id")
    .eq("id", leaderboardId)
    .maybeSingle();
  const teamId = board?.team_id ?? null;

  // Overtake detection is best-effort — a snapshot failure must not
  // block the entry upsert.
  let before = new Map<string, Map<string, number>>();
  if (teamId) {
    try {
      before = await snapshotStandings(teamId);
    } catch (err) {
      console.error("[leaderboards] snapshotStandings failed:", err);
    }
  }

  const { error } = await supabase
    .from("leaderboard_entries")
    .upsert(
      { leaderboard_id: leaderboardId, user_id: user.id, value: parsed.data.value },
      { onConflict: "leaderboard_id,user_id" },
    );

  if (error) return { message: error.message };

  if (teamId && before.size > 0) {
    await notifyOvertakes({
      teamId,
      teamSlug: slug,
      actorUserId: user.id,
      before,
    });
  }

  revalidatePath(`/t/${slug}/leaderboards/${leaderboardId}`);
  return { message: "Saved." };
}

/**
 * Increment the caller's standalone entry by `delta` (can be negative).
 * Creates the row at `delta` if it didn't exist, otherwise adds to the
 * existing value. Used by the +1 / Add-X buttons on standalone boards.
 */
export async function addToStandaloneEntry(
  slug: string,
  leaderboardId: string,
  delta: number,
): Promise<{ ok: true; value: number } | { ok: false; message: string }> {
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, message: "Bad delta." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: board } = await supabase
    .from("leaderboards")
    .select("team_id, status")
    .eq("id", leaderboardId)
    .maybeSingle();
  if (!board) return { ok: false, message: "Leaderboard not found." };
  if (board.status !== "active") {
    return { ok: false, message: "Leaderboard is not active." };
  }

  // Snapshot for overtake detection (best-effort).
  let before = new Map<string, Map<string, number>>();
  try {
    before = await snapshotStandings(board.team_id);
  } catch (err) {
    console.error("[leaderboards] snapshotStandings failed:", err);
  }

  // Read the existing value, then upsert. Two-step instead of a SQL
  // increment because PostgREST doesn't expose "value = value + delta"
  // directly without an RPC; this is fine at our concurrency.
  const { data: existing } = await supabase
    .from("leaderboard_entries")
    .select("value")
    .eq("leaderboard_id", leaderboardId)
    .eq("user_id", user.id)
    .maybeSingle();
  const current = existing ? Number(existing.value) : 0;
  const next = current + delta;

  const { error } = await supabase
    .from("leaderboard_entries")
    .upsert(
      {
        leaderboard_id: leaderboardId,
        user_id: user.id,
        value: next,
      },
      { onConflict: "leaderboard_id,user_id" },
    );

  if (error) return { ok: false, message: error.message };

  if (before.size > 0) {
    await notifyOvertakes({
      teamId: board.team_id,
      teamSlug: slug,
      actorUserId: user.id,
      before,
    });
  }

  revalidatePath(`/t/${slug}/leaderboards/${leaderboardId}`);
  return { ok: true, value: next };
}
