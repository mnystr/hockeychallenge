import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

const PAGE_SIZE = 50;

// Maps the raw audit action string -> i18n key under admin.audit.actions.
// Anything missing falls back to the raw action — new events show up
// immediately without a code change.
const ACTION_KEYS: Record<string, string> = {
  "team.orphaned": "team_orphaned",
  "team.unorphaned": "team_unorphaned",
  "team_request.approved": "team_request_approved",
  "team_request.rejected": "team_request_rejected",
  "membership.approved": "member_approved",
  "membership.rejected": "member_rejected",
  "membership.promoted_to_admin": "member_promoted",
  "membership.demoted": "member_demoted",
  "membership.removed": "member_removed",
  "roster.exported": "roster_exported",
  "invite.created": "invite_created",
  "invite.redeemed": "invite_redeemed",
  "invite.redeem_failed": "invite_redemption_failed",
  "invite.revoked": "invite_revoked",
  "profile_change.submitted": "profile_change_submitted",
  "profile_change.approved": "profile_change_approved",
  "profile_change.rejected": "profile_change_rejected",
  "challenge.created": "challenge_created",
  "challenge.completed": "challenge_completed",
  "challenge.uncompleted": "challenge_regressed",
  "leaderboard.archived": "leaderboard_archived",
  "team_change.submitted": "team_change_submitted",
  "team_change.approved": "team_change_approved",
  "team_change.rejected": "team_change_rejected",
};

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  let ctx;
  try {
    ctx = await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unauthorized") redirect("/login");
    if (msg === "team not found") notFound();
    redirect(`/t/${slug}`);
  }

  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: entries, count } = await supabase
    .from("audit_log")
    .select("id, actor_user_id, action, target_type, target_id, details, created_at", { count: "exact" })
    .eq("team_id", ctx.teamId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const actorIds = Array.from(
    new Set((entries ?? []).map((e) => e.actor_user_id).filter((v): v is string => Boolean(v))),
  );
  const actorNameByUser = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("team_id", ctx.teamId)
      .in("user_id", actorIds)
      .is("deleted_at", null);
    for (const p of profiles ?? []) {
      actorNameByUser.set(p.user_id, p.display_name);
    }
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>
      <h1 className="mb-1 text-3xl font-extrabold tracking-tight">
        {t("admin.audit.title")}
      </h1>
      <p className="mb-6 text-sm text-muted">{t("admin.audit.intro")}</p>

      {entries && entries.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {entries.map((e) => {
            const key = ACTION_KEYS[e.action];
            const label = key ? t(`admin.audit.actions.${key}`) : e.action;
            return (
              <li key={e.id} className="card card-pad">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="font-semibold tracking-tight">{label}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {actorNameByUser.get(e.actor_user_id ?? "") ??
                        (e.actor_user_id
                          ? `${e.actor_user_id.slice(0, 8)}…`
                          : "system")}
                      {" · "}
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                  {e.details && Object.keys(e.details).length > 0 && (
                    <details className="text-xs text-muted sm:max-w-xs">
                      <summary className="cursor-pointer select-none text-ui-primary">
                        {t("admin.audit.details")}
                      </summary>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-[color:var(--surface-2)] p-2 text-[11px]">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card card-pad text-sm text-muted">
          {t("admin.audit.empty")}
        </p>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/t/${slug}/admin/audit?page=${page - 1}`}
              className="text-ui-primary hover:underline"
            >
              {t("admin.audit.newer")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {t("admin.audit.page_of", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={`/t/${slug}/admin/audit?page=${page + 1}`}
              className="text-ui-primary hover:underline"
            >
              {t("admin.audit.older")}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}
