import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Plus } from "@/components/icons";
import { createChallengeDraft } from "./actions";

export default async function ChallengesAdminListPage({
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
  const { data: audienceRows } = await supabase
    .from("challenge_audience")
    .select("challenge_id")
    .eq("team_id", ctx.teamId);
  const challengeIds = (audienceRows ?? []).map((r) => r.challenge_id);

  const { data: challenges } = challengeIds.length
    ? await supabase
        .from("challenges")
        .select("id, title, status, publish_at, starts_at, ends_at, updated_at")
        .in("id", challengeIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

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
          {t("admin.challenges.title")}
        </h1>
        <form
          action={async () => {
            "use server";
            await createChallengeDraft(slug);
          }}
        >
          <button className="btn btn-primary">
            <Plus className="h-4 w-4" />
            {t("admin.challenges.new_challenge")}
          </button>
        </form>
      </div>

      {challenges && challenges.length > 0 ? (
        <ul className="space-y-2">
          {challenges.map((c) => (
            <li key={c.id}>
              <Link
                href={`/t/${slug}/admin/challenges/${c.id}`}
                className="card card-pad card-hover card-link flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold tracking-tight">
                    {c.title || t("admin.challenges.untitled")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t("admin.challenges.updated", {
                      date: new Date(c.updated_at).toLocaleString(),
                    })}
                    {c.ends_at &&
                      ` · ${t("admin.challenges.ends", {
                        date: new Date(c.ends_at).toLocaleDateString(),
                      })}`}
                  </div>
                </div>
                <StatusBadge status={c.status} t={t} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card card-pad text-sm text-muted">
          {t("admin.challenges.empty")}
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
    status === "draft"
      ? "admin.challenges.status_draft"
      : status === "published"
        ? "admin.challenges.status_published"
        : "admin.challenges.status_archived";
  const cls =
    status === "published"
      ? "pill pill-success"
      : status === "archived"
        ? "pill pill-warning"
        : "pill";
  return <span className={cls}>{t(labelKey)}</span>;
}
