import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { restoreChallenge, restoreLeaderboard, restoreLesson } from "./actions";

export default async function TrashPage({
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

  const { data: deletedChallenges } = challengeIds.length
    ? await supabase
        .from("challenges")
        .select("id, title, deleted_at")
        .in("id", challengeIds)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
    : { data: [] };

  const { data: deletedLeaderboards } = await supabase
    .from("leaderboards")
    .select("id, name, kind, deleted_at")
    .eq("team_id", ctx.teamId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const { data: deletedLessons } = await supabase
    .from("lessons")
    .select("id, title, deleted_at")
    .eq("team_id", ctx.teamId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const anything =
    (deletedChallenges && deletedChallenges.length > 0) ||
    (deletedLeaderboards && deletedLeaderboards.length > 0) ||
    (deletedLessons && deletedLessons.length > 0);

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
        {t("admin.trash.title")}
      </h1>
      <p className="mb-6 text-sm text-muted">{t("admin.trash.intro")}</p>

      {deletedChallenges && deletedChallenges.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">{t("admin.trash.challenges")}</h2>
          <ul className="space-y-2">
            {deletedChallenges.map((c) => (
              <li
                key={c.id}
                className="card card-pad flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold tracking-tight">
                    {c.title || t("admin.trash.untitled")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t("admin.trash.deleted", {
                      date: new Date(c.deleted_at!).toLocaleString(),
                    })}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await restoreChallenge(slug, c.id);
                  }}
                >
                  <button className="btn btn-secondary btn-sm">
                    {t("admin.trash.restore")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deletedLessons && deletedLessons.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">{t("admin.trash.lessons")}</h2>
          <ul className="space-y-2">
            {deletedLessons.map((l) => (
              <li
                key={l.id}
                className="card card-pad flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold tracking-tight">
                    {l.title || t("admin.trash.untitled")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t("admin.trash.deleted", {
                      date: new Date(l.deleted_at!).toLocaleString(),
                    })}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await restoreLesson(slug, l.id);
                  }}
                >
                  <button className="btn btn-secondary btn-sm">
                    {t("admin.trash.restore")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deletedLeaderboards && deletedLeaderboards.length > 0 && (
        <section>
          <h2 className="section-title mb-3">
            {t("admin.trash.leaderboards")}
          </h2>
          <ul className="space-y-2">
            {deletedLeaderboards.map((l) => (
              <li
                key={l.id}
                className="card card-pad flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold tracking-tight">{l.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t("admin.trash.kind_deleted", {
                      kind: l.kind,
                      date: new Date(l.deleted_at!).toLocaleString(),
                    })}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await restoreLeaderboard(slug, l.id);
                  }}
                >
                  <button className="btn btn-secondary btn-sm">
                    {t("admin.trash.restore")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!anything && (
        <p className="card card-pad text-sm text-muted">
          {t("admin.trash.empty")}
        </p>
      )}
    </main>
  );
}
