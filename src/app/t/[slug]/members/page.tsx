import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  renderDisplayName,
  type Visibility,
} from "@/lib/profiles/display-name";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership || membership.status !== "active") {
    redirect(`/t/${slug}`);
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    appUser?.is_super_admin === true || membership.role === "team_admin";

  // RLS + profiles_self_read already enforces the correct visibility:
  // non-admins only see approved profiles; admins see pending/approved.
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "user_id, display_name, jersey_number, pronouns, visibility, approved",
    )
    .eq("team_id", team.id)
    .is("deleted_at", null);

  // Role info per member so we can badge team-admins.
  const { data: roleRows } = await supabase
    .from("memberships")
    .select("user_id, role, status")
    .eq("team_id", team.id)
    .is("deleted_at", null);
  const roleByUser = new Map<string, { role: string; status: string }>();
  for (const r of roleRows ?? []) {
    roleByUser.set(r.user_id, { role: r.role, status: r.status });
  }

  // For non-admins, filter to approved + active members only. Admins see
  // everyone so they can cross-reference with the approvals queue.
  const visible = (profiles ?? []).filter((p) => {
    const m = roleByUser.get(p.user_id);
    if (isAdmin) return m?.status === "active";
    return p.approved && m?.status === "active";
  });

  // Sort: team_admins first, then by display_name.
  visible.sort((a, b) => {
    const aAdmin = roleByUser.get(a.user_id)?.role === "team_admin";
    const bAdmin = roleByUser.get(b.user_id)?.role === "team_admin";
    if (aAdmin !== bAdmin) return aAdmin ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← {team.name}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Roster</h1>

      {visible.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {visible.map((p) => {
            const isYou = p.user_id === user.id;
            // Admins and each row's owner see the raw display_name.
            const shown =
              isAdmin || isYou
                ? p.display_name
                : renderDisplayName(p.display_name, p.visibility as Visibility);
            const role = roleByUser.get(p.user_id)?.role;
            return (
              <li
                key={p.user_id}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  isYou ? "bg-blue-50" : ""
                }`}
              >
                <div>
                  <div className="font-medium">
                    {shown}
                    {isYou && <span className="ml-1 text-gray-500">(you)</span>}
                    {role === "team_admin" && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        admin
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {p.jersey_number !== null
                      ? `#${p.jersey_number}`
                      : "No jersey number"}
                    {p.pronouns ? ` · ${p.pronouns}` : ""}
                    {isAdmin && !p.approved && " · profile pending"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No active members yet.</p>
      )}
    </main>
  );
}
