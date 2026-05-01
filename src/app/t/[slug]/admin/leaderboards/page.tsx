import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Plus } from "@/components/icons";

export default async function LeaderboardsAdminListPage({
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
  const { data: boards } = await supabase
    .from("leaderboards")
    .select("id, name, kind, status, starts_at, ends_at, updated_at")
    .eq("team_id", ctx.teamId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("admin.leaderboards.title")}
        </h1>
        <Link
          href={`/t/${slug}/admin/leaderboards/new`}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          {t("admin.leaderboards.new_leaderboard")}
        </Link>
      </div>

      {boards && boards.length > 0 ? (
        <ul className="space-y-2">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/t/${slug}/admin/leaderboards/${b.id}`}
                className="card card-pad card-hover card-link flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold tracking-tight">{b.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {b.kind}
                    {b.ends_at &&
                      ` · ${t("admin.leaderboards.ends", {
                        date: new Date(b.ends_at).toLocaleDateString(),
                      })}`}
                    {" · "}
                    {t("admin.leaderboards.updated", {
                      date: new Date(b.updated_at).toLocaleString(),
                    })}
                  </div>
                </div>
                <StatusBadge status={b.status} t={t} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card card-pad text-sm text-muted">
          {t("admin.leaderboards.empty")}
        </p>
      )}
    </main>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const labelKey =
    status === "archived"
      ? "admin.leaderboards.status_archived"
      : "admin.leaderboards.status_active";
  const cls =
    status === "archived" ? "pill pill-warning" : "pill pill-success";
  return <span className={cls}>{t(labelKey)}</span>;
}
