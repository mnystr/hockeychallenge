import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getT } from "@/lib/i18n/server";
import { Shield, Users } from "@/components/icons";
import {
  approveTeamRequest,
  rejectTeamRequest,
  promoteMemberToAdmin,
  approveTeamChange,
  rejectTeamChange,
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
    redirect("/");
  }

  const [requests, orphaned, renames] = await Promise.all([
    supabase
      .from("team_creation_requests")
      .select(
        "id, proposed_name, requested_by, requested_by_name, requester_role, request_note, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("teams")
      .select(
        "id, name, slug, memberships(id, role, status, user_id, deleted_at)",
      )
      .eq("status", "orphaned")
      .is("deleted_at", null),
    supabase
      .from("team_change_requests")
      .select("id, team_id, proposed_name, created_at, teams!inner(name, slug)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const requesterEmails = new Map<string, string | null>();
  const requesterIds = Array.from(
    new Set((requests.data ?? []).map((r) => r.requested_by)),
  );
  if (requesterIds.length > 0) {
    const admin = createServiceClient();
    const lookups = await Promise.all(
      requesterIds.map((id) => admin.auth.admin.getUserById(id)),
    );
    requesterIds.forEach((id, i) => {
      requesterEmails.set(id, lookups[i].data.user?.email ?? null);
    });
  }
  type RenameRow = {
    id: string;
    team_id: string;
    proposed_name: string;
    created_at: string;
    teams: { name: string; slug: string } | { name: string; slug: string }[];
  };
  const renameRows = (renames.data ?? []) as RenameRow[];

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl"
          style={{
            background: "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
            color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
          }}
        >
          <Shield className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t("admin.super.title")}
          </h1>
          <p className="text-sm text-muted">{t("admin.super.intro")}</p>
        </div>
      </header>
      <div className="mb-8">
        <Link href="/admin/users" className="btn btn-secondary">
          <Users className="h-4 w-4" />
          {t("admin.super.user_lookup")}
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="section-title mb-3">
          {t("admin.super.pending_team_requests")}
        </h2>
        {requests.data && requests.data.length > 0 ? (
          <ul className="space-y-3">
            {requests.data.map((r) => {
              const roleLabel = r.requester_role
                ? t(`admin.super.requester_role_${r.requester_role}`)
                : null;
              const email = requesterEmails.get(r.requested_by) ?? null;
              const displayName =
                r.requested_by_name?.trim() ||
                t("admin.super.applicant_no_name");
              return (
                <li key={r.id} className="card card-pad">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold tracking-tight">
                        {r.proposed_name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-medium">{displayName}</span>
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            className="text-ui-primary hover:underline"
                          >
                            {email}
                          </a>
                        ) : (
                          <span className="text-muted-2">
                            {t("admin.super.applicant_no_email")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {roleLabel ? (
                          <>
                            <span>{roleLabel}</span>
                            {" · "}
                          </>
                        ) : null}
                        {t("admin.super.requested", {
                          date: new Date(r.created_at).toLocaleString(),
                        })}
                      </div>
                      {r.request_note ? (
                        <p className="mt-2 whitespace-pre-wrap rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] p-2 text-sm">
                          {r.request_note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await approveTeamRequest(r.id);
                        }}
                      >
                        <button className="btn btn-primary btn-sm">
                          {t("admin.super.approve")}
                        </button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await rejectTeamRequest(r.id, null);
                        }}
                      >
                        <button className="btn btn-secondary btn-sm">
                          {t("admin.super.reject")}
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card card-pad text-sm text-muted">
            {t("admin.super.no_pending_requests")}
          </p>
        )}
      </section>

      {renameRows.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title mb-3">
            {t("admin.super.pending_team_renames")}
          </h2>
          <ul className="space-y-3">
            {renameRows.map((r) => {
              const team = Array.isArray(r.teams) ? r.teams[0] : r.teams;
              return (
                <li
                  key={r.id}
                  className="card card-pad flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold tracking-tight">
                      <span className="line-through text-muted">
                        {team?.name ?? "—"}
                      </span>{" "}
                      → <span>{r.proposed_name}</span>
                    </div>
                    <div className="text-xs text-muted">
                      <Link
                        href={`/t/${team?.slug}`}
                        className="hover:underline"
                      >
                        /t/{team?.slug}
                      </Link>
                      {" · "}
                      {t("admin.super.requested", {
                        date: new Date(r.created_at).toLocaleString(),
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await approveTeamChange(r.id);
                      }}
                    >
                      <button className="btn btn-primary btn-sm">
                        {t("admin.super.approve")}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rejectTeamChange(r.id, null);
                      }}
                    >
                      <button className="btn btn-secondary btn-sm">
                        {t("admin.super.reject")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">{t("admin.super.orphaned_teams")}</h2>
        {orphaned.data && orphaned.data.length > 0 ? (
          <ul className="space-y-3">
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
                <li key={team.id} className="card card-pad">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/t/${team.slug}`}
                        className="font-semibold tracking-tight hover:underline"
                      >
                        {team.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {activePlayers.length}{" "}
                        {activePlayers.length === 1
                          ? t("admin.super.active_member")
                          : t("admin.super.active_members")}
                      </div>
                    </div>
                  </div>
                  {activePlayers.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {activePlayers.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-1.5"
                        >
                          <span className="mono text-xs text-muted">
                            {m.user_id.slice(0, 8)}…
                          </span>
                          <form
                            action={async () => {
                              "use server";
                              await promoteMemberToAdmin(m.id);
                            }}
                          >
                            <button className="btn btn-primary btn-sm">
                              {t("admin.super.promote_to_admin")}
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">
                      {t("admin.super.no_active_members_to_promote")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card card-pad text-sm text-muted">
            {t("admin.super.no_orphaned_teams")}
          </p>
        )}
      </section>

      <form action="/logout" method="post" className="mt-10 text-center">
        <button className="text-sm text-muted-2 hover:text-app-fg hover:underline">
          {t("common.sign_out")}
        </button>
      </form>
    </main>
  );
}
