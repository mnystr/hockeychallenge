import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shield } from "@/components/icons";

export default async function TeamAdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
  const [
    pendingMemberships,
    pendingChanges,
    activeInvites,
    challengeCount,
    leaderboardCount,
    lessonCount,
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId)
      .eq("status", "pending")
      .is("deleted_at", null),
    supabase
      .from("profile_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId)
      .eq("status", "pending"),
    supabase
      .from("team_invites")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId)
      .is("revoked_at", null),
    supabase
      .from("challenge_audience")
      .select("challenge_id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId),
    supabase
      .from("leaderboards")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId)
      .is("deleted_at", null),
    supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId)
      .is("deleted_at", null),
  ]);
  const totalPending =
    (pendingMemberships.count ?? 0) + (pendingChanges.count ?? 0);

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="section-title mb-2">{ctx.teamName}</p>
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
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("admin.dashboard.title")}
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <DashCard
          href={`/t/${slug}/admin/approvals`}
          title={t("admin.dashboard.approvals")}
          body={t("admin.dashboard.pending_count", { count: totalPending })}
          highlight={totalPending > 0}
        />
        <DashCard
          href={`/t/${slug}/admin/invites`}
          title={t("admin.dashboard.invites")}
          body={t("admin.dashboard.active_count", {
            count: activeInvites.count ?? 0,
          })}
        />
        <DashCard
          href={`/t/${slug}/admin/challenges`}
          title={t("admin.dashboard.challenges")}
          body={t("admin.dashboard.total_count", {
            count: challengeCount.count ?? 0,
          })}
        />
        <DashCard
          href={`/t/${slug}/admin/leaderboards`}
          title={t("admin.dashboard.leaderboards")}
          body={t("admin.dashboard.total_count", {
            count: leaderboardCount.count ?? 0,
          })}
        />
        <DashCard
          href={`/t/${slug}/admin/lessons`}
          title={t("admin.dashboard.lessons")}
          body={t("admin.dashboard.total_count", {
            count: lessonCount.count ?? 0,
          })}
        />
        <DashCard
          href={`/t/${slug}/admin/settings`}
          title={t("admin.dashboard.settings")}
          body={t("admin.dashboard.settings_body")}
        />
        <DashCard
          href={`/t/${slug}/admin/audit`}
          title={t("admin.dashboard.audit")}
          body={t("admin.dashboard.audit_body")}
        />
        <DashCard
          href={`/t/${slug}/admin/trash`}
          title={t("admin.dashboard.trash")}
          body={t("admin.dashboard.trash_body")}
        />
      </div>

      <Link
        href={`/t/${slug}`}
        className="mt-8 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.dashboard.back_to_team")}
      </Link>
    </main>
  );
}

function DashCard({
  href,
  title,
  body,
  highlight = false,
}: {
  href: string;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card card-pad card-hover card-link"
      style={
        highlight
          ? {
              borderColor:
                "color-mix(in oklab, var(--ui-accent) 50%, transparent)",
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--ui-accent) 12%, var(--surface)) 0%, var(--surface) 65%)",
            }
          : undefined
      }
    >
      <div className="font-semibold tracking-tight">{title}</div>
      <div className="mt-1 text-sm text-muted">{body}</div>
    </Link>
  );
}
