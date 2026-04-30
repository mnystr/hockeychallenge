import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { setSuperAdmin } from "./actions";

type TeamMembership = {
  role: string;
  status: string;
  deleted_at: string | null;
  teams: { id: string; name: string; slug: string } | null;
};

type Row = {
  id: string;
  email: string | null;
  created_at: string;
  is_super_admin: boolean;
  deleted_at: string | null;
  profiles: { display_name: string; team_id: string }[];
  memberships: TeamMembership[];
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!appUser?.is_super_admin) redirect("/");

  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();

  let rows: Row[] = [];
  let error: string | null = null;

  if (q) {
    try {
      const admin = createServiceClient();
      // Auth admin API filters by email substring when passed via `filter`.
      // We cap to 25 results; for a small league site that's plenty.
      const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 25,
      });
      if (authErr) throw authErr;

      const needle = q.toLowerCase();
      const matched = authData.users.filter((u) => {
        if (u.email?.toLowerCase().includes(needle)) return true;
        if (u.id.toLowerCase() === needle) return true;
        return false;
      });

      if (matched.length > 0) {
        const ids = matched.map((u) => u.id);
        const [appUsersRes, profilesRes, membershipsRes] = await Promise.all([
          admin.from("app_users").select("id, is_super_admin, deleted_at").in("id", ids),
          admin
            .from("profiles")
            .select("user_id, display_name, team_id")
            .in("user_id", ids),
          admin
            .from("memberships")
            .select("user_id, role, status, deleted_at, teams(id, name, slug)")
            .in("user_id", ids),
        ]);
        const appMap = new Map<string, { is_super_admin: boolean; deleted_at: string | null }>();
        for (const a of appUsersRes.data ?? [])
          appMap.set(a.id, { is_super_admin: a.is_super_admin, deleted_at: a.deleted_at });
        const profilesByUser = new Map<string, { display_name: string; team_id: string }[]>();
        for (const p of profilesRes.data ?? []) {
          const arr = profilesByUser.get(p.user_id) ?? [];
          arr.push({ display_name: p.display_name, team_id: p.team_id });
          profilesByUser.set(p.user_id, arr);
        }
        const membershipsByUser = new Map<string, TeamMembership[]>();
        for (const m of membershipsRes.data ?? []) {
          const arr = membershipsByUser.get(m.user_id as string) ?? [];
          arr.push({
            role: m.role as string,
            status: m.status as string,
            deleted_at: m.deleted_at as string | null,
            teams: (m as unknown as { teams: TeamMembership["teams"] }).teams,
          });
          membershipsByUser.set(m.user_id as string, arr);
        }

        rows = matched.map((u) => ({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at ?? "",
          is_super_admin: appMap.get(u.id)?.is_super_admin ?? false,
          deleted_at: appMap.get(u.id)?.deleted_at ?? null,
          profiles: profilesByUser.get(u.id) ?? [],
          memberships: membershipsByUser.get(u.id) ?? [],
        }));
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/admin"
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Super-admin
      </Link>
      <h1 className="mb-6 text-3xl font-bold">User lookup</h1>

      <form method="GET" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by email or user id"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!q && (
        <p className="text-sm text-gray-500">
          Enter an email address or user id above to look up an account. Results
          are limited to 25 matches at a time.
        </p>
      )}

      {q && rows.length === 0 && !error && (
        <p className="text-sm text-gray-500">No users matched that search.</p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-gray-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {r.email ?? "(no email)"}
                    {r.is_super_admin && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        super-admin
                      </span>
                    )}
                    {r.deleted_at && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        deleted
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-gray-500">
                    {r.id}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Joined {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await setSuperAdmin(r.id, !r.is_super_admin);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {r.is_super_admin ? "Revoke super-admin" : "Grant super-admin"}
                  </button>
                </form>
              </div>

              {r.memberships.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                    Teams
                  </div>
                  <ul className="space-y-1 text-sm">
                    {r.memberships.map((m, i) => {
                      const profile = r.profiles.find(
                        (p) => p.team_id === m.teams?.id,
                      );
                      const isDeleted = m.deleted_at !== null;
                      return (
                        <li
                          key={`${m.teams?.id ?? "x"}-${i}`}
                          className="flex items-center justify-between"
                        >
                          <span>
                            {m.teams ? (
                              <Link
                                href={`/t/${m.teams.slug}`}
                                className="text-blue-600 hover:underline"
                              >
                                {m.teams.name}
                              </Link>
                            ) : (
                              <span className="text-gray-400">(unknown team)</span>
                            )}
                            <span className="ml-2 text-xs text-gray-500">
                              {m.role} · {isDeleted ? "deleted" : m.status}
                            </span>
                            {profile && (
                              <span className="ml-2 text-xs text-gray-500">
                                as {profile.display_name}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
