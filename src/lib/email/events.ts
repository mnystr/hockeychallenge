import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "./send";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Resolve a list of user ids to email addresses via the Auth admin API.
 * Requires SUPABASE_SERVICE_ROLE_KEY; returns [] if absent so callers
 * can skip sending cleanly in dev without the key set.
 */
async function resolveEmails(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info(
      "[email] SUPABASE_SERVICE_ROLE_KEY absent — can't resolve recipient emails. Skipping.",
    );
    return [];
  }
  const admin = createServiceClient();
  const emails: string[] = [];
  for (const uid of userIds) {
    const { data, error } = await admin.auth.admin.getUserById(uid);
    if (error || !data?.user?.email) continue;
    emails.push(data.user.email);
  }
  return emails;
}

/**
 * Email every audience member who has email_new_challenge=true for the
 * team. Runs alongside the DB trigger that fanned out in-app notifications.
 * Failures are swallowed after logging so the publish action doesn't
 * error out if the email provider is down.
 */
export async function emailNewChallenge(params: {
  challengeId: string;
  teamSlug: string;
  title: string;
}) {
  try {
    const supabase = await createClient();

    const { data: audience } = await supabase
      .from("challenge_audience")
      .select("team_id")
      .eq("challenge_id", params.challengeId);
    const teamIds = (audience ?? []).map((a) => a.team_id);
    if (teamIds.length === 0) return;

    const { data: recipients } = await supabase
      .from("notification_preferences")
      .select("user_id, team_id")
      .in("team_id", teamIds)
      .eq("email_new_challenge", true);
    const userIds = Array.from(
      new Set((recipients ?? []).map((r) => r.user_id)),
    );

    const emails = await resolveEmails(userIds);
    if (emails.length === 0) return;

    const url = `${baseUrl()}/t/${params.teamSlug}/challenges/${params.challengeId}`;

    await sendEmail({
      to: emails,
      subject: `New challenge: ${params.title}`,
      text: `A new challenge "${params.title}" was just published.\n\nOpen it: ${url}\n\nManage email preferences: ${baseUrl()}/notifications`,
    });
  } catch (err) {
    console.error("[email] emailNewChallenge failed:", err);
  }
}

/**
 * Email every team member who has email_new_lesson=true when a lesson is
 * published. Runs alongside the DB trigger that fans out in-app
 * notifications. Failures are swallowed after logging so the publish
 * action doesn't error out if the email provider is down.
 */
export async function emailNewLesson(params: {
  lessonId: string;
  teamSlug: string;
  title: string;
}) {
  try {
    const supabase = await createClient();

    const { data: lesson } = await supabase
      .from("lessons")
      .select("team_id")
      .eq("id", params.lessonId)
      .maybeSingle();
    if (!lesson) return;

    const { data: recipients } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("team_id", lesson.team_id)
      .eq("email_new_lesson", true);
    const userIds = Array.from(
      new Set((recipients ?? []).map((r) => r.user_id)),
    );

    const emails = await resolveEmails(userIds);
    if (emails.length === 0) return;

    const url = `${baseUrl()}/t/${params.teamSlug}/lessons/${params.lessonId}`;

    await sendEmail({
      to: emails,
      subject: `New lesson: ${params.title}`,
      text: `A new lesson "${params.title}" was just published.\n\nRead it: ${url}\n\nManage email preferences: ${baseUrl()}/notifications`,
    });
  } catch (err) {
    console.error("[email] emailNewLesson failed:", err);
  }
}

/**
 * Email active team-admins of a team when something is pending review
 * (membership application, profile change request). Only admins with
 * email_approval_needed=true are emailed.
 */
export async function emailApprovalNeeded(params: {
  teamId: string;
  teamName: string;
  teamSlug: string;
  kind: "membership" | "profile_change";
}) {
  try {
    const admin = createServiceClient();

    const { data: adminMemberships } = await admin
      .from("memberships")
      .select("user_id")
      .eq("team_id", params.teamId)
      .eq("role", "team_admin")
      .eq("status", "active")
      .is("deleted_at", null);
    const adminIds = (adminMemberships ?? []).map((m) => m.user_id);
    if (adminIds.length === 0) return;

    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("user_id")
      .eq("team_id", params.teamId)
      .eq("email_approval_needed", true)
      .in("user_id", adminIds);
    const userIds = (prefs ?? []).map((p) => p.user_id);

    const emails = await resolveEmails(userIds);
    if (emails.length === 0) return;

    const url = `${baseUrl()}/t/${params.teamSlug}/admin/approvals`;
    const what =
      params.kind === "membership"
        ? "a new member application"
        : "a profile change";

    await sendEmail({
      to: emails,
      subject: `Approval needed: ${params.teamName}`,
      text: `${what} is waiting for your review on ${params.teamName}.\n\nReview: ${url}\n\nManage email preferences: ${baseUrl()}/notifications`,
    });
  } catch (err) {
    console.error("[email] emailApprovalNeeded failed:", err);
  }
}

/**
 * Email users who opted in (email_leaderboard_passed=true) when they
 * lose a rank on an active points leaderboard. `passedUserIds` is the
 * set of users who were overtaken since the last send.
 */
export async function emailLeaderboardPassed(params: {
  leaderboardId: string;
  teamId: string;
  teamSlug: string;
  leaderboardName: string;
  passedUserIds: string[];
}) {
  try {
    if (params.passedUserIds.length === 0) return;
    const admin = createServiceClient();

    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("user_id")
      .eq("team_id", params.teamId)
      .eq("email_leaderboard_passed", true)
      .in("user_id", params.passedUserIds);
    const userIds = (prefs ?? []).map((p) => p.user_id);

    const emails = await resolveEmails(userIds);
    if (emails.length === 0) return;

    const url = `${baseUrl()}/t/${params.teamSlug}/leaderboards/${params.leaderboardId}`;

    await sendEmail({
      to: emails,
      subject: `You were passed on ${params.leaderboardName}`,
      text: `Someone moved ahead of you on the "${params.leaderboardName}" leaderboard.\n\nTake a look: ${url}\n\nManage email preferences: ${baseUrl()}/notifications`,
    });
  } catch (err) {
    console.error("[email] emailLeaderboardPassed failed:", err);
  }
}

/**
 * Email all active super-admins when a team goes orphaned (no active
 * team-admins left).
 */
export async function emailTeamOrphaned(params: {
  teamId: string;
  teamName: string;
  teamSlug: string;
}) {
  try {
    const admin = createServiceClient();

    const { data: supers } = await admin
      .from("app_users")
      .select("id")
      .eq("is_super_admin", true)
      .is("deleted_at", null);
    const userIds = (supers ?? []).map((s) => s.id);

    const emails = await resolveEmails(userIds);
    if (emails.length === 0) return;

    const url = `${baseUrl()}/admin`;

    await sendEmail({
      to: emails,
      subject: `Team without admin: ${params.teamName}`,
      text: `"${params.teamName}" has no active team admins left.\n\nAssign one from the super-admin dashboard: ${url}`,
    });
  } catch (err) {
    console.error("[email] emailTeamOrphaned failed:", err);
  }
}
