import { createClient } from "@/lib/supabase/server";

export type SessionState =
  | { kind: "anonymous" }
  | { kind: "no_memberships"; userId: string; email: string | null; hasPendingTeamRequest: boolean; hasPendingMembership: boolean; isSuperAdmin: boolean }
  | { kind: "has_memberships"; userId: string; email: string | null; defaultTeamSlug: string; isSuperAdmin: boolean };

/**
 * Figure out where an authenticated visitor should land. Pure read — does
 * not mutate anything. Used by the root route and any page that needs to
 * branch on onboarding state.
 */
export async function getSessionState(): Promise<SessionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { kind: "anonymous" };

  const { data: appUser } = await supabase
    .from("app_users")
    .select("default_team_id, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperAdmin = appUser?.is_super_admin ?? false;

  // Active memberships first — if any, redirect to default team.
  const { data: memberships } = await supabase
    .from("memberships")
    .select("team_id, teams!inner(slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null);

  if (memberships && memberships.length > 0) {
    const defaultRow = memberships.find(
      (m) => m.team_id === appUser?.default_team_id,
    ) ?? memberships[0];
    // teams is returned as a nested object when using !inner join
    const slug = (defaultRow.teams as unknown as { slug: string }).slug;
    return { kind: "has_memberships", userId: user.id, email: user.email ?? null, defaultTeamSlug: slug, isSuperAdmin };
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
    isSuperAdmin,
  };
}

/**
 * Helper used by page guards. Throws a Next.js redirect if the caller isn't
 * a team-admin of this team (or super-admin). Returns the user id + team id
 * on success.
 */
export async function requireTeamAdmin(slug: string): Promise<{
  userId: string;
  teamId: string;
  teamName: string;
  isSuperAdmin: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) throw new Error("team not found");

  const [{ data: appUser }, { data: membership }] = await Promise.all([
    supabase.from("app_users").select("is_super_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("team_id", team.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const isSuperAdmin = appUser?.is_super_admin ?? false;
  const isTeamAdmin =
    membership?.role === "team_admin" && membership?.status === "active";

  if (!isSuperAdmin && !isTeamAdmin) throw new Error("forbidden");

  return {
    userId: user.id,
    teamId: team.id,
    teamName: team.name,
    isSuperAdmin,
  };
}
