import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";

const PAGE_SIZE = 50;

// Pretty labels per audit action string. Anything missing falls back to
// the raw action — new events are immediately visible without a code change.
const ACTION_LABELS: Record<string, string> = {
  "team.orphaned": "Team became orphaned",
  "team.unorphaned": "Team no longer orphaned",
  "team_request.approved": "Team request approved",
  "team_request.rejected": "Team request rejected",
  "membership.approved": "Member approved",
  "membership.rejected": "Member rejected",
  "membership.promoted_to_admin": "Member promoted to admin",
  "invite.created": "Invite created",
  "invite.redeemed": "Invite redeemed",
  "invite.redeem_failed": "Invite redemption failed",
  "invite.revoked": "Invite revoked",
  "profile_change.submitted": "Profile change submitted",
  "profile_change.approved": "Profile change approved",
  "profile_change.rejected": "Profile change rejected",
  "challenge.created": "Challenge created",
  "challenge.completed": "Challenge completed",
  "challenge.uncompleted": "Challenge regressed",
  "leaderboard.archived": "Leaderboard archived",
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <h1 className="mb-1 text-3xl font-bold">Audit log</h1>
      <p className="mb-6 text-sm text-gray-500">
        Every membership approval, profile change, invite event, and
        challenge edit. Append-only.
      </p>

      {entries && entries.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {actorNameByUser.get(e.actor_user_id ?? "") ??
                      (e.actor_user_id ? `${e.actor_user_id.slice(0, 8)}…` : "system")}
                    {" · "}
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                {e.details && Object.keys(e.details).length > 0 && (
                  <details className="text-xs text-gray-600 sm:max-w-xs">
                    <summary className="cursor-pointer select-none text-blue-600">
                      details
                    </summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px]">
                      {JSON.stringify(e.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No audit entries yet.</p>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/t/${slug}/admin/audit?page=${page - 1}`}
              className="text-blue-600 hover:underline"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/t/${slug}/admin/audit?page=${page + 1}`}
              className="text-blue-600 hover:underline"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}
