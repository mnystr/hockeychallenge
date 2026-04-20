"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOvertakes, snapshotStandings } from "@/lib/leaderboards/overtake";

export async function setTaskProgress(
  slug: string,
  challengeId: string,
  taskId: string,
  count: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const clamped = Math.max(0, Math.min(count, 100_000));

  // Points leaderboards derive from challenge_completions, so a progress
  // update can move the actor up and push someone else down. Snapshot
  // standings for the challenge's audience teams before the mutation.
  // Everything in this block is best-effort: a failure here must not
  // block the task_progress upsert.
  const { data: audience } = await supabase
    .from("challenge_audience")
    .select("team_id")
    .eq("challenge_id", challengeId);
  const teamIds = (audience ?? []).map((a) => a.team_id);
  const before = new Map<string, Map<string, number>>();
  try {
    for (const tid of teamIds) {
      const snap = await snapshotStandings(tid);
      for (const [boardId, ranks] of snap.entries()) before.set(boardId, ranks);
    }
  } catch (err) {
    console.error("[challenges] snapshotStandings failed:", err);
  }

  const { error } = await supabase
    .from("task_progress")
    .upsert(
      { task_id: taskId, user_id: user.id, count: clamped },
      { onConflict: "task_id,user_id" },
    );

  if (error) throw new Error(error.message);

  if (before.size > 0) {
    for (const tid of teamIds) {
      await notifyOvertakes({
        teamId: tid,
        teamSlug: slug,
        actorUserId: user.id,
        before,
      });
    }
  }

  revalidatePath(`/t/${slug}/challenges/${challengeId}`);
}
