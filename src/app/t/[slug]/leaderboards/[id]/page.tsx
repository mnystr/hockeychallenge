import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  renderDisplayName,
  type Visibility,
} from "@/lib/profiles/display-name";
import { getT } from "@/lib/i18n/server";
import StandaloneEntryForm from "./entry-form";
import { ChevronLeft, Trophy, Medal, Star } from "@/components/icons";
import TeamShell from "@/components/TeamShell";

type Row = {
  user_id: string;
  display_name: string;
  value: number;
  rank: number;
  display_order: number;
};

export default async function LeaderboardDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
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

  const { data: board } = await supabase
    .from("leaderboards")
    .select(
      "id, name, description, kind, sort_order, unit, starts_at, ends_at, status, archived_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!board) notFound();

  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  const isAdmin =
    appUser?.is_super_admin === true ||
    (membership?.role === "team_admin" && membership?.status === "active");

  let rows: Row[] = [];
  let ownRow: Row | null = null;

  if (board.status === "archived") {
    const { data: snapshots } = await supabase
      .from("leaderboard_snapshots")
      .select("user_id, display_name, value, rank")
      .eq("leaderboard_id", id)
      .order("rank", { ascending: true })
      .order("display_name", { ascending: true });
    rows = (snapshots ?? []).map((s, i) => ({
      ...s,
      value: Number(s.value),
      display_order: i + 1,
    }));
    ownRow = rows.find((r) => r.user_id === user.id) ?? null;
  } else {
    const { data: standings } = await supabase
      .from("leaderboard_active_standings")
      .select("user_id, display_name, value, rank, display_order")
      .eq("leaderboard_id", id)
      .order("display_order", { ascending: true });
    const all = (standings ?? []).map((r) => ({
      ...r,
      value: Number(r.value),
    })) as Row[];
    ownRow = all.find((r) => r.user_id === user.id) ?? null;
    rows = isAdmin
      ? all
      : all.filter((r) => r.value > 0 || r.user_id === user.id);
  }

  const rowUserIds = rows.map((r) => r.user_id);
  const visibilityByUser = new Map<string, Visibility>();
  if (rowUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, visibility")
      .eq("team_id", team.id)
      .in("user_id", rowUserIds)
      .eq("approved", true)
      .is("deleted_at", null);
    for (const p of profiles ?? []) {
      visibilityByUser.set(p.user_id, p.visibility as Visibility);
    }
  }

  const t = await getT();

  function nameFor(r: Row) {
    const isYou = r.user_id === user!.id;
    return isAdmin || isYou
      ? r.display_name
      : renderDisplayName(
          r.display_name,
          visibilityByUser.get(r.user_id) ?? "full",
        );
  }

  // Build podium positions {1, 2, 3}, taking the first row at each rank
  // (ties are resolved by the view's display_order). Anyone tied at the
  // same rank that doesn't fit on the podium falls through to restRows
  // so they're still visible.
  const podiumByRank = new Map<number, Row>();
  for (const r of rows) {
    if (r.rank <= 3 && !podiumByRank.has(r.rank)) {
      podiumByRank.set(r.rank, r);
    }
  }
  const podiumUserIds = new Set(
    Array.from(podiumByRank.values()).map((r) => r.user_id),
  );
  const restRows = rows.filter((r) => !podiumUserIds.has(r.user_id));

  return (
    <>
    <TeamShell slug={slug} active="leaderboards" />
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        href={`/t/${slug}/leaderboards`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ui-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("nav.leaderboards")}
      </Link>

      <section className="hero-panel mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className="pill"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.35)",
              }}
            >
              {board.kind === "points"
                ? t("leaderboards.kind_points")
                : t("leaderboards.kind_standalone")}
              {board.unit ? ` · ${board.unit}` : ""}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {board.name}
            </h1>
            {board.status === "archived" && (
              <p className="mt-2 text-sm text-white/80">
                {t("leaderboards.archived", {
                  date: board.archived_at
                    ? new Date(board.archived_at).toLocaleDateString()
                    : "",
                })}
              </p>
            )}
            {board.description && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">
                {board.description}
              </p>
            )}
          </div>
          <Trophy
            className="hidden h-20 w-20 shrink-0 sm:block"
            style={{
              color: "#ffd66b",
              filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.25))",
            }}
          />
        </div>
      </section>

      {board.kind === "standalone" && board.status === "active" && (
        <section className="card card-pad mb-6">
          <h2 className="section-title mb-3">
            {t("leaderboards.entry_title")}
          </h2>
          <StandaloneEntryForm
            slug={slug}
            leaderboardId={id}
            unit={board.unit}
            currentValue={ownRow?.value ?? null}
            strings={{
              value_label: t("leaderboards.value_label"),
              submit: t("leaderboards.entry_submit"),
              update: t("leaderboards.entry_update"),
              pending: t("leaderboards.entry_pending"),
              saved: t("leaderboards.entry_saved"),
              add_one: t("leaderboards.add_one"),
              add_x_label: t("leaderboards.add_x_label"),
              add: t("leaderboards.add"),
              current_value: t("leaderboards.current_value"),
            }}
          />
        </section>
      )}

      <section>
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-ui-accent" />
          {t("leaderboards.standings")}
        </h2>

        {rows.length === 0 ? (
          <p className="card card-pad text-sm text-muted">
            {board.kind === "points"
              ? t("leaderboards.empty_points")
              : t("leaderboards.empty_standalone")}
          </p>
        ) : (
          <>
            {podiumByRank.size > 0 && (
              <Podium
                rank1={podiumByRank.get(1) ?? null}
                rank2={podiumByRank.get(2) ?? null}
                rank3={podiumByRank.get(3) ?? null}
                youId={user.id}
                unit={board.unit}
                nameFor={nameFor}
                youLabel={t("leaderboards.you")}
              />
            )}

            {restRows.length > 0 && (
              <ol className="standings-list mt-6">
                {restRows.map((r) => {
                  const isYou = r.user_id === user.id;
                  return (
                    <li
                      key={r.user_id}
                      className={`standings-row ${isYou ? "is-you" : ""}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="standings-rank">{r.rank}</span>
                        <span className="standings-name truncate">
                          {nameFor(r)}
                          {isYou && (
                            <span className="ml-1 text-xs text-muted">
                              {t("leaderboards.you")}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="standings-value">
                        {r.value}
                        {board.unit ? ` ${board.unit}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </section>
    </main>
    </>
  );
}

function Podium({
  rank1,
  rank2,
  rank3,
  youId,
  unit,
  nameFor,
  youLabel,
}: {
  rank1: Row | null;
  rank2: Row | null;
  rank3: Row | null;
  youId: string;
  unit: string | null;
  nameFor: (r: Row) => string;
  youLabel: string;
}) {
  return (
    <ol className="podium">
      {rank2 && (
        <li
          className={`podium-card podium-2 ${rank2.user_id === youId ? "is-you" : ""}`}
        >
          <div className="podium-medal">
            <Medal className="h-6 w-6" />
          </div>
          <div className="text-xs font-bold tracking-widest text-muted-2">2ND</div>
          <div className="podium-name mt-1">
            {nameFor(rank2)}
            {rank2.user_id === youId && (
              <span className="ml-1 text-xs text-muted">{youLabel}</span>
            )}
          </div>
          <div className="podium-value">
            {rank2.value}
            {unit ? ` ${unit}` : ""}
          </div>
        </li>
      )}
      {rank1 && (
        <li
          className={`podium-card podium-1 ${rank1.user_id === youId ? "is-you" : ""}`}
        >
          <Trophy className="podium-trophy" />
          <div className="podium-medal mt-1">
            <Star className="h-6 w-6" />
          </div>
          <div
            className="text-xs font-bold tracking-widest"
            style={{ color: "var(--gold-2)" }}
          >
            CHAMPION
          </div>
          <div className="podium-name mt-1">
            {nameFor(rank1)}
            {rank1.user_id === youId && (
              <span className="ml-1 text-xs text-muted">{youLabel}</span>
            )}
          </div>
          <div className="podium-value">
            {rank1.value}
            {unit ? ` ${unit}` : ""}
          </div>
        </li>
      )}
      {rank3 && (
        <li
          className={`podium-card podium-3 ${rank3.user_id === youId ? "is-you" : ""}`}
        >
          <div className="podium-medal">
            <Medal className="h-6 w-6" />
          </div>
          <div className="text-xs font-bold tracking-widest text-muted-2">3RD</div>
          <div className="podium-name mt-1">
            {nameFor(rank3)}
            {rank3.user_id === youId && (
              <span className="ml-1 text-xs text-muted">{youLabel}</span>
            )}
          </div>
          <div className="podium-value">
            {rank3.value}
            {unit ? ` ${unit}` : ""}
          </div>
        </li>
      )}
    </ol>
  );
}
