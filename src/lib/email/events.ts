import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "./send";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
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
    if (userIds.length === 0) return;

    // We need auth.users.email — server-side Supabase with RLS won't
    // expose other users' emails to us. Use the admin client (service
    // role) so the cron/server action can look them up. Fall back to a
    // raw query through the public Supabase client if no service role
    // key is present (we'll just fail to send in that case).
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.info(
        "[email] SUPABASE_SERVICE_ROLE_KEY absent — can't resolve recipient emails. Skipping new-challenge email.",
      );
      return;
    }

    const { createClient: createAdmin } = await import("@supabase/supabase-js");
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false } },
    );
    // Use the Auth admin endpoint to fetch emails in chunks.
    const emails: string[] = [];
    for (const uid of userIds) {
      const { data, error } = await admin.auth.admin.getUserById(uid);
      if (error || !data?.user?.email) continue;
      emails.push(data.user.email);
    }
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
