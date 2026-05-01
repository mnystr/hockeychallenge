import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getT } from "@/lib/i18n/server";
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

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        href="/admin"
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.user_lookup.back_super")}
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        {t("admin.user_lookup.title")}
      </h1>

      <form method="GET" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("admin.user_lookup.placeholder")}
          className="input flex-1"
        />
        <button type="submit" className="btn btn-primary">
          {t("admin.user_lookup.search")}
        </button>
      </form>

      {error && (
        <p className="pill pill-danger mb-4 px-3 py-2 text-sm">{error}</p>
      )}

      {!q && (
        <p className="card card-pad text-sm text-muted">
          {t("admin.user_lookup.instructions")}
        </p>
      )}

      {q && rows.length === 0 && !error && (
        <p className="card card-pad text-sm text-muted">
          {t("admin.user_lookup.no_match")}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold tracking-tight">
                    {r.email ?? t("admin.user_lookup.no_email")}
                    {r.is_super_admin && (
                      <span className="pill pill-warning ml-2">
                        {t("admin.user_lookup.super_admin_badge")}
                      </span>
                    )}
                    {r.deleted_at && (
                      <span className="pill pill-danger ml-2">
                        {t("admin.user_lookup.deleted")}
                      </span>
                    )}
                  </div>
                  <div className="mono mt-1 text-xs text-muted-2">{r.id}</div>
                  <div className="mt-1 text-xs text-muted">
                    {t("admin.user_lookup.joined", {
                      date: r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : "—",
                    })}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await setSuperAdmin(r.id, !r.is_super_admin);
                  }}
                >
                  <button type="submit" className="btn btn-secondary btn-sm">
                    {r.is_super_admin
                      ? t("admin.user_lookup.revoke_super")
                      : t("admin.user_lookup.grant_super")}
                  </button>
                </form>
              </div>

              {r.memberships.length > 0 && (
                <div className="mt-3">
                  <div className="section-title mb-1">
                    {t("admin.user_lookup.teams")}
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
                                className="font-medium text-ui-primary hover:underline"
                              >
                                {m.teams.name}
                              </Link>
                            ) : (
                              <span className="text-muted-2">
                                {t("admin.user_lookup.unknown_team")}
                              </span>
                            )}
                            <span className="ml-2 text-xs text-muted">
                              {m.role} ·{" "}
                              {isDeleted
                                ? t("admin.user_lookup.deleted")
                                : m.status}
                            </span>
                            {profile && (
                              <span className="ml-2 text-xs text-muted">
                                {t("admin.user_lookup.as", {
                                  name: profile.display_name,
                                })}
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
