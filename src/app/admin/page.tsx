import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  approveTeamRequest,
  rejectTeamRequest,
  promoteMemberToAdmin,
} from "./actions";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser?.is_super_admin) {
    // Not a super-admin — fall back to the normal root redirect.
    redirect("/");
  }

  const [requests, orphaned] = await Promise.all([
    supabase
      .from("team_creation_requests")
      .select("id, proposed_name, requested_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("teams")
      .select(
        "id, name, slug, memberships(id, role, status, user_id, deleted_at)",
      )
      .eq("status", "orphaned")
      .is("deleted_at", null),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Super-admin</h1>
      <p className="mb-4 text-sm text-gray-500">
        Approve new teams and un-orphan teams that have lost their admins.
      </p>
      <div className="mb-8">
        <Link
          href="/admin/users"
          className="inline-block rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          User lookup
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">Pending team requests</h2>
        {requests.data && requests.data.length > 0 ? (
          <ul className="space-y-3">
            {requests.data.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-gray-200 p-4"
              >
                <div>
                  <div className="font-medium">{r.proposed_name}</div>
                  <div className="text-xs text-gray-500">
                    Requested {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await approveTeamRequest(r.id);
                    }}
                  >
                    <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                      Approve
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await rejectTeamRequest(r.id, null);
                    }}
                  >
                    <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No pending requests.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Orphaned teams</h2>
        {orphaned.data && orphaned.data.length > 0 ? (
          <ul className="space-y-4">
            {orphaned.data.map((team) => {
              const activePlayers = (
                team.memberships as unknown as Array<{
                  id: string;
                  role: string;
                  status: string;
                  user_id: string;
                  deleted_at: string | null;
                }>
              ).filter(
                (m) => m.status === "active" && m.deleted_at === null,
              );
              return (
                <li
                  key={team.id}
                  className="rounded-md border border-gray-200 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <Link
                        href={`/t/${team.slug}`}
                        className="font-medium hover:underline"
                      >
                        {team.name}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {activePlayers.length} active member
                        {activePlayers.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  {activePlayers.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {activePlayers.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between"
                        >
                          <span className="font-mono text-xs text-gray-600">
                            {m.user_id.slice(0, 8)}…
                          </span>
                          <form
                            action={async () => {
                              "use server";
                              await promoteMemberToAdmin(m.id);
                            }}
                          >
                            <button className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700">
                              Promote to team-admin
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No active members to promote. You may need to join the
                      team yourself first.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No orphaned teams.</p>
        )}
      </section>

      <form action="/logout" method="post" className="mt-10 text-center">
        <button className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
