import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";
import {
  Bell,
  BookOpen,
  Check,
  Shield,
  ShieldStar,
  Target,
  Trophy,
  User,
  Users,
} from "@/components/icons";
import { setDefaultTeam } from "./actions";

type FeedItem = {
  kind: "challenge" | "lesson" | "leaderboard";
  id: string;
  title: string;
  at: string | null;
  done: boolean;
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slug, status, logo_path, header_image_path")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();
  const logoUrl = publicMediaUrl(team.logo_path);
  const headerUrl = publicMediaUrl(team.header_image_path);

  const [{ data: appUser }, { data: memberships }, unreadNotifs] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("is_super_admin, default_team_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("role, status, team_id, teams!inner(name, slug)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("deleted_at", null),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
  const unreadCount = unreadNotifs.count ?? 0;

  const isSuperAdmin = appUser?.is_super_admin ?? false;
  const membership = (memberships ?? []).find((m) => m.team_id === team.id);
  const isTeamAdmin =
    membership?.role === "team_admin" && membership?.status === "active";
  const otherTeams = (memberships ?? [])
    .filter((m) => m.team_id !== team.id)
    .map((m) => ({
      id: m.team_id,
      name: (m.teams as unknown as { name: string }).name,
      slug: (m.teams as unknown as { slug: string }).slug,
    }));
  const isDefault = appUser?.default_team_id === team.id;
  const t = await getT();

  // ------------------------------------------------------------------
  // Activity feed: latest published challenges + lessons and active
  // leaderboards, merged and sorted by their publish/update time. RLS
  // already scopes everything to what this viewer may see; the extra
  // status/publish_at filters keep admin-visible drafts out of the feed.
  // ------------------------------------------------------------------
  const now = new Date();
  const { data: audienceRows } = await supabase
    .from("challenge_audience")
    .select("challenge_id")
    .eq("team_id", team.id);
  const challengeIds = (audienceRows ?? []).map((r) => r.challenge_id);

  const [{ data: feedChallenges }, { data: feedLessons }, { data: feedBoards }] =
    await Promise.all([
      challengeIds.length
        ? supabase
            .from("challenges")
            .select("id, title, publish_at, updated_at")
            .in("id", challengeIds)
            .eq("status", "published")
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(6)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              title: string;
              publish_at: string | null;
              updated_at: string;
            }>,
          }),
      supabase
        .from("lessons")
        .select("id, title, publish_at, updated_at")
        .eq("team_id", team.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("leaderboards")
        .select("id, name, starts_at, updated_at")
        .eq("team_id", team.id)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

  const liveChallenges = (feedChallenges ?? []).filter(
    (c) => !c.publish_at || new Date(c.publish_at) <= now,
  );
  const liveLessons = (feedLessons ?? []).filter(
    (l) => !l.publish_at || new Date(l.publish_at) <= now,
  );

  const [{ data: feedCompletions }, { data: feedReads }] = await Promise.all([
    liveChallenges.length
      ? supabase
          .from("challenge_completions")
          .select("challenge_id")
          .eq("user_id", user.id)
          .in(
            "challenge_id",
            liveChallenges.map((c) => c.id),
          )
      : Promise.resolve({ data: [] as Array<{ challenge_id: string }> }),
    liveLessons.length
      ? supabase
          .from("lesson_reads")
          .select("lesson_id")
          .eq("user_id", user.id)
          .in(
            "lesson_id",
            liveLessons.map((l) => l.id),
          )
      : Promise.resolve({ data: [] as Array<{ lesson_id: string }> }),
  ]);
  const completedIds = new Set(
    (feedCompletions ?? []).map((c) => c.challenge_id),
  );
  const readIds = new Set((feedReads ?? []).map((r) => r.lesson_id));

  const feed: FeedItem[] = [
    ...liveChallenges.map((c) => ({
      kind: "challenge" as const,
      id: c.id,
      title: c.title,
      at: c.publish_at ?? c.updated_at,
      done: completedIds.has(c.id),
    })),
    ...liveLessons.map((l) => ({
      kind: "lesson" as const,
      id: l.id,
      title: l.title,
      at: l.publish_at ?? l.updated_at,
      done: readIds.has(l.id),
    })),
    ...(feedBoards ?? []).map((b) => ({
      kind: "leaderboard" as const,
      id: b.id,
      title: b.name,
      at: b.starts_at ?? b.updated_at,
      done: false,
    })),
  ]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, 6);

  const logoBlock = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/30 bg-white/10 object-cover shadow-lg backdrop-blur"
    />
  ) : (
    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-white/30 bg-white/10 text-2xl font-extrabold text-white backdrop-blur">
      {team.name.slice(0, 1)}
    </div>
  );

  const titleBlock = (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {team.name}
      </h1>
      {team.status === "orphaned" && (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-100 ring-1 ring-amber-200/60">
          {t("team.orphaned")}
        </p>
      )}
    </div>
  );

  const buttonsBlock = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/notifications"
        className="relative inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">{t("nav.notifications")}</span>
        {unreadCount > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-[color:var(--ui-primary)]">
            {unreadCount}
          </span>
        )}
      </Link>
      {isSuperAdmin && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
        >
          <ShieldStar className="h-4 w-4" />
          {t("nav.super_admin")}
        </Link>
      )}
      {(isTeamAdmin || isSuperAdmin) && (
        <Link
          href={`/t/${slug}/admin`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
        >
          <Shield className="h-4 w-4" />
          {t("nav.admin")}
        </Link>
      )}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Hero */}
      <section className={`hero-panel${headerUrl ? " hero-panel--photo" : ""}`}>
        {headerUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headerUrl} alt="" className="hero-image" />
            <div
              className="flex items-end gap-3 sm:gap-4"
              style={{
                position: "absolute",
                bottom: "0.375rem",
                left: "0.375rem",
                right: "0.375rem",
                zIndex: 2,
                padding: "1rem 1.25rem",
              }}
            >
              {logoBlock}
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
                {titleBlock}
                {buttonsBlock}
              </div>
            </div>
          </>
        ) : (
          <div
            className="flex flex-wrap items-start justify-between gap-4"
            style={{ position: "relative" }}
          >
            <div className="flex items-start gap-4">
              {logoBlock}
              {titleBlock}
            </div>
            {buttonsBlock}
          </div>
        )}
      </section>

      {otherTeams.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">{t("team.switch_to")}</span>
          {otherTeams.map((o) => (
            <Link
              key={o.id}
              href={`/t/${o.slug}`}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-0.5 font-medium text-app-fg shadow-sm transition hover:bg-[color:var(--surface-2)]"
            >
              {o.name}
            </Link>
          ))}
          {!isDefault && membership && (
            <form
              action={async () => {
                "use server";
                await setDefaultTeam(team.id);
              }}
            >
              <button className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-0.5 font-medium text-app-fg shadow-sm transition hover:bg-[color:var(--surface-2)]">
                {t("team.set_default")}
              </button>
            </form>
          )}
          {isDefault && <span className="text-muted-2">{t("team.default_tag")}</span>}
        </div>
      )}

      <nav className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard
          href={`/t/${slug}/challenges`}
          icon={<Target className="h-6 w-6" />}
          title={t("nav.challenges")}
          body={t("team.challenges_card")}
        />
        <NavCard
          href={`/t/${slug}/leaderboards`}
          icon={<Trophy className="h-6 w-6" />}
          title={t("nav.leaderboards")}
          body={t("team.leaderboards_card")}
          tone="accent"
        />
        <NavCard
          href={`/t/${slug}/lessons`}
          icon={<BookOpen className="h-6 w-6" />}
          title={t("nav.lessons")}
          body={t("team.lessons_card")}
        />
        <NavCard
          href={`/t/${slug}/members`}
          icon={<Users className="h-6 w-6" />}
          title={t("nav.roster")}
          body={t("team.roster_card")}
        />
        <NavCard
          href={`/t/${slug}/profile`}
          icon={<User className="h-6 w-6" />}
          title={t("nav.profile")}
          body={t("team.profile_card")}
        />
      </nav>

      {feed.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-3">{t("team.feed_title")}</h2>
          <ul className="space-y-2">
            {feed.map((item) => {
              const href =
                item.kind === "challenge"
                  ? `/t/${slug}/challenges/${item.id}`
                  : item.kind === "lesson"
                    ? `/t/${slug}/lessons/${item.id}`
                    : `/t/${slug}/leaderboards/${item.id}`;
              const kindLabel =
                item.kind === "challenge"
                  ? t("team.feed_kind_challenge")
                  : item.kind === "lesson"
                    ? t("team.feed_kind_lesson")
                    : t("team.feed_kind_leaderboard");
              const doneLabel =
                item.kind === "challenge"
                  ? t("challenges.complete_badge")
                  : t("lessons.read_badge");
              return (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={href}
                    className="card card-pad card-hover card-link flex items-center gap-3"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{
                        background:
                          "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
                        color:
                          "color-mix(in oklab, var(--ui-primary) 75%, black)",
                      }}
                    >
                      {item.kind === "challenge" ? (
                        <Target className="h-5 w-5" />
                      ) : item.kind === "lesson" ? (
                        <BookOpen className="h-5 w-5" />
                      ) : (
                        <Trophy className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold tracking-tight">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {kindLabel}
                        {item.at &&
                          ` · ${new Date(item.at).toLocaleDateString()}`}
                      </span>
                    </span>
                    {item.done && (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
                        style={{
                          background: "var(--success-bg)",
                          color: "var(--success-fg)",
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {doneLabel}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between text-xs text-muted-2">
        <Link href="/settings/data" className="hover:underline">
          {t("settings_data.title")}
        </Link>
        <form action="/logout" method="post">
          <button type="submit" className="hover:underline">
            {t("common.sign_out")}
          </button>
        </form>
      </div>
    </main>
  );
}

function NavCard({
  href,
  icon,
  title,
  body,
  tone = "primary",
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "primary" | "accent";
}) {
  const iconBg =
    tone === "accent"
      ? "color-mix(in oklab, var(--ui-accent) 18%, var(--surface))"
      : "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))";
  const iconFg =
    tone === "accent"
      ? "color-mix(in oklab, var(--ui-accent) 70%, black)"
      : "color-mix(in oklab, var(--ui-primary) 75%, black)";
  return (
    <Link href={href} className="card card-pad card-hover card-link">
      <div className="flex items-center gap-3">
        <div
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </div>
        <div className="font-semibold tracking-tight">{title}</div>
      </div>
      <div className="mt-2 text-sm text-muted">{body}</div>
    </Link>
  );
}
