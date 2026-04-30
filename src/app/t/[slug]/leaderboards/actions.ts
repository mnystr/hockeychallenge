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
