import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Trophy, Sparkles } from "@/components/icons";
import { isChallengeCardTheme } from "@/lib/challenges/card-themes";
import TeamShell from "@/components/TeamShell";

type BoardRow = {
  id: string;
  name: string;
  kind: "points" | "standalone";
  status: "active" | "archived";
  unit: string | null;
  starts_at: string | null;
  ends_at: string | null;
  card_theme: string | null;
};

export default async function LeaderboardsListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership || membership.status !== "active") {
    redirect(`/t/${slug}`);
  }

  const { data: boards } = await supabase
    .from("leaderboards")
    .select(
      "id, name, kind, status, unit, starts_at, ends_at, card_theme",
    )
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const allBoards = (boards ?? []) as BoardRow[];
  const active = allBoards.filter((b) => b.status === "active");
  const archived = allBoards.filter((b) => b.status === "archived");

  // Look up the viewer's own rank on every visible board so we can show it
  // on the card. Active boards come from the live view; archived boards
  // from the immutable snapshot. value === 0 on an active board means the
  // user has an entry row but hasn't actually placed yet (standalone with
  // zero, or points with no completions inside the window).
  const activeIds = active.map((b) => b.id);
  const archivedIds = archived.map((b) => b.id);

  const ownRankByBoard = new Map<string, { rank: number; value: number }>();

  if (activeIds.length > 0) {
    const { data: standings } = await supabase
      .from("leaderboard_active_standings")
      .select("leaderboard_id, value, rank")
      .in("leaderboard_id", activeIds)
      .eq("user_id", user.id);
    for (const row of standings ?? []) {
      ownRankByBoard.set(row.leaderboard_id, {
        rank: row.rank,
        value: Number(row.value),
      });
    }
  }

  if (archivedIds.length > 0) {
    const { data: snapshots } = await supabase
      .from("leaderboard_snapshots")
      .select("leaderboard_id, value, rank")
      .in("leaderboard_id", archivedIds)
      .eq("user_id", user.id);
    for (const row of snapshots ?? []) {
      ownRankByBoard.set(row.leaderboard_id, {
        rank: row.rank,
        value: Number(row.value),
      });
    }
  }

  const t = await getT();

  return (
    <>
      <TeamShell slug={slug} active="leaderboards" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background:
                "color-mix(in oklab, var(--ui-accent) 22%, var(--surface))",
              color: "color-mix(in oklab, var(--ui-accent) 70%, black)",
            }}
          >
            <Trophy className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("leaderboards.list_title")}
          </h1>
        </header>

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">{t("leaderboards.active")}</h2>
          <ul className="flex flex-col gap-4">
            {active.map((b) => (
              <BoardCard
                key={b.id}
                slug={slug}
                board={b}
                rank={ownRankByBoard.get(b.id) ?? null}
                t={t}
              />
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{t("leaderboards.history")}</h2>
          <ul className="flex flex-col gap-4">
            {archived.map((b) => (
              <BoardCard
                key={b.id}
                slug={slug}
                board={b}
                rank={ownRankByBoard.get(b.id) ?? null}
                t={t}
                archived
              />
            ))}
          </ul>
        </section>
      )}

      {active.length === 0 && archived.length === 0 && (
        <p className="card card-pad text-sm text-muted">
          {t("leaderboards.empty")}
        </p>
      )}
      </main>
    </>
  );
}

function BoardCard({
  slug,
  board,
  rank,
  t,
  archived = false,
}: {
  slug: string;
  board: BoardRow;
  rank: { rank: number; value: number } | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  archived?: boolean;
}) {
  const themeAttr = isChallengeCardTheme(board.card_theme)
    ? board.card_theme
    : undefined;

  // Treat zero-value rows as "not ranked yet" on active boards — the user
  // has an entry row but hasn't placed in any meaningful sense. For
  // archived boards the snapshot is authoritative, so show whatever's
  // there.
  const showRank = rank !== null && (archived || rank.value > 0);
  const rankLabel = showRank
    ? t("leaderboards.rank_value", { rank: rank!.rank })
    : t("leaderboards.no_rank");

  return (
    <li>
      <Link
        href={`/t/${slug}/leaderboards/${board.id}`}
        className="challenge-card"
        data-theme={themeAttr}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {board.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {archived ? (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/85 ring-1 ring-white/25">
                {t("leaderboards.ended")}
              </span>
            ) : (
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white ring-1 ring-white/30">
                {board.kind === "points"
                  ? t("leaderboards.kind_points")
                  : t("leaderboards.kind_standalone")}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs/relaxed text-white/85 sm:text-sm/relaxed">
          {board.unit && <span className="mono">{board.unit}</span>}
          {board.ends_at && (
            <span>
              {archived
                ? t("leaderboards.ended")
                : t("leaderboards.ends")}{" "}
              {new Date(board.ends_at).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-app-fg shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-ui-primary" />
          <span className="uppercase tracking-wider text-muted-2 text-[0.65rem]">
            {t("leaderboards.your_rank")}
          </span>
          <span className="mono text-base">{rankLabel}</span>
        </div>
      </Link>
    </li>
  );
}
