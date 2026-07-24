import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GDPR-lite export. Returns the caller's data as a JSON download.
 * Only data directly about the caller — not other teammates' rows
 * they can see through RLS.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", "http://localhost"));
  }

  const [
    appUser,
    memberships,
    profiles,
    profileChangeRequests,
    taskProgress,
    challengeCompletions,
    lessonReads,
    leaderboardEntries,
    notifications,
    notificationPrefs,
    teamCreationRequests,
  ] = await Promise.all([
    supabase.from("app_users").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("*").eq("user_id", user.id),
    supabase.from("profiles").select("*").eq("user_id", user.id),
    supabase
      .from("profile_change_requests")
      .select("*")
      .eq("user_id", user.id),
    supabase.from("task_progress").select("*").eq("user_id", user.id),
    supabase.from("challenge_completions").select("*").eq("user_id", user.id),
    supabase.from("lesson_reads").select("*").eq("user_id", user.id),
    supabase.from("leaderboard_entries").select("*").eq("user_id", user.id),
    supabase.from("notifications").select("*").eq("user_id", user.id),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id),
    supabase
      .from("team_creation_requests")
      .select("*")
      .eq("requested_by", user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    auth_user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    app_user: appUser.data,
    memberships: memberships.data ?? [],
    profiles: profiles.data ?? [],
    profile_change_requests: profileChangeRequests.data ?? [],
    task_progress: taskProgress.data ?? [],
    challenge_completions: challengeCompletions.data ?? [],
    lesson_reads: lessonReads.data ?? [],
    leaderboard_entries: leaderboardEntries.data ?? [],
    notifications: notifications.data ?? [],
    notification_preferences: notificationPrefs.data ?? [],
    team_creation_requests: teamCreationRequests.data ?? [],
  };

  const body = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hockeychallenge-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
