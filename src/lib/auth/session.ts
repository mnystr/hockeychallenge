import { createClient } from "@/lib/supabase/server";

export type SessionState =
  | { kind: "anonymous" }
  | { kind: "no_memberships"; userId: string; email: string | null; hasPendingTeamRequest: boolean; hasPendingMembership: boolean }
  | { kind: "has_memberships"; userId: string; email: string | null; defaultTeamSlug: string };

/**
 * Figure out where an authenticated visitor should land. Pure read — does
 * not mutate anything. Used by the root route and any page that needs to
 * branch on onboarding state.
 */
export async function getSessionState(): Promise<SessionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { kind: "anonymous" };

  // Active memberships first — if any, redirect to default team.
  const { data: memberships } = await supabase
    .from("memberships")
    .select("team_id, teams!inner(slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null);

  if (memberships && memberships.length > 0) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("default_team_id")
      .eq("id", user.id)
      .single();

    const defaultRow = memberships.find(
      (m) => m.team_id === appUser?.default_team_id,
    ) ?? memberships[0];
    // teams is returned as a nested object when using !inner join
    const slug = (defaultRow.teams as unknown as { slug: string }).slug;
    return { kind: "has_memberships", userId: user.id, email: user.email ?? null, defaultTeamSlug: slug };
  }

  // No active memberships — check if they have pending ones.
  const { count: pendingMembershipCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .is("deleted_at", null);

  const { count: pendingTeamReqCount } = await supabase
    .from("team_creation_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .eq("status", "pending");

  return {
    kind: "no_memberships",
    userId: user.id,
    email: user.email ?? null,
    hasPendingMembership: (pendingMembershipCount ?? 0) > 0,
    hasPendingTeamRequest: (pendingTeamReqCount ?? 0) > 0,
  };
}
