"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function markAllRead() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", {
    p_ids: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

export async function markOneRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", {
    p_ids: [id],
  });
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

type PrefUpdate = {
  team_id: string;
  email_new_challenge: boolean;
  email_new_lesson: boolean;
  email_leaderboard_passed: boolean;
  email_approval_needed: boolean;
  in_app_new_challenge: boolean;
  in_app_new_lesson: boolean;
  in_app_leaderboard_passed: boolean;
};

export async function updatePreferences(
  _state: unknown,
  formData: FormData,
): Promise<{ message?: string } | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Not authenticated." };

  // One form with a row per team; fields are named `<team_id>__<field>`.
  const updates = new Map<string, PrefUpdate>();
  for (const [key, value] of formData.entries()) {
    const [teamId, field] = key.split("__");
    if (!teamId || !field) continue;
    let row = updates.get(teamId);
    if (!row) {
      row = {
        team_id: teamId,
        email_new_challenge: false,
        email_new_lesson: false,
        email_leaderboard_passed: false,
        email_approval_needed: false,
        in_app_new_challenge: false,
        in_app_new_lesson: false,
        in_app_leaderboard_passed: false,
      };
      updates.set(teamId, row);
    }
    // Checkbox values are "on" when checked, absent when unchecked.
    if (field in row) {
      (row as unknown as Record<string, boolean>)[field] = value === "on";
    }
  }

  for (const row of updates.values()) {
    const { error } = await supabase
      .from("notification_preferences")
      .update({
        email_new_challenge: row.email_new_challenge,
        email_new_lesson: row.email_new_lesson,
        email_leaderboard_passed: row.email_leaderboard_passed,
        email_approval_needed: row.email_approval_needed,
        in_app_new_challenge: row.in_app_new_challenge,
        in_app_new_lesson: row.in_app_new_lesson,
        in_app_leaderboard_passed: row.in_app_leaderboard_passed,
      })
      .eq("user_id", user.id)
      .eq("team_id", row.team_id);
    if (error) return { message: error.message };
  }

  revalidatePath("/notifications");
  const t = await getT();
  return { message: t("notifications.prefs_saved") };
}
