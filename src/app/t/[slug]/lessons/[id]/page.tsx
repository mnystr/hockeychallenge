import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import Markdown from "@/components/Markdown";
import TeamShell from "@/components/TeamShell";
import {
  BookOpen,
  ChevronLeft,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "@/components/icons";
import { isChallengeCardTheme } from "@/lib/challenges/card-themes";
import MarkReadButton from "./mark-read-button";

export default async function LessonDetailPage({
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

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, body_md, read_points, card_theme, status, publish_at")
    .eq("id", id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!lesson) notFound();

  const [{ data: read }, { data: links }] = await Promise.all([
    supabase
      .from("lesson_reads")
      .select("read_at, points_awarded")
      .eq("lesson_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("lesson_links")
      .select("id, challenge_id, leaderboard_id, position")
      .eq("lesson_id", id)
      .order("position", { ascending: true }),
  ]);

  // Resolve related-content titles. RLS hides drafts from players, so a
  // linked-but-unpublished challenge simply drops out of the list.
  const challengeIds = (links ?? [])
    .map((l) => l.challenge_id)
    .filter((v): v is string => !!v);
  const leaderboardIds = (links ?? [])
    .map((l) => l.leaderboard_id)
    .filter((v): v is string => !!v);
  const [{ data: linkedChallenges }, { data: linkedLeaderboards }] =
    await Promise.all([
      challengeIds.length
        ? supabase
            .from("challenges")
            .select("id, title")
            .in("id", challengeIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
      leaderboardIds.length
        ? supabase
            .from("leaderboards")
            .select("id, name")
            .in("id", leaderboardIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
  const challengeById = new Map(
    (linkedChallenges ?? []).map((c) => [c.id, c.title]),
  );
  const leaderboardById = new Map(
    (linkedLeaderboards ?? []).map((l) => [l.id, l.name]),
  );
  const visibleLinks = (links ?? []).filter((l) =>
    l.challenge_id
      ? challengeById.has(l.challenge_id)
      : leaderboardById.has(l.leaderboard_id!),
  );

  const isLive =
    lesson.status === "published" &&
    (!lesson.publish_at || new Date(lesson.publish_at) <= new Date());

  const t = await getT();

  return (
    <>
      <TeamShell slug={slug} active="lessons" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          href={`/t/${slug}/lessons`}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ui-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("lessons.back_to_lessons")}
        </Link>

        <section
          className="challenge-card mb-6"
          data-theme={
            isChallengeCardTheme(lesson.card_theme)
              ? lesson.card_theme
              : undefined
          }
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80">
            <BookOpen className="h-4 w-4" />
            {t("lessons.kind_label")}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {lesson.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/85">
            {lesson.publish_at && (
              <span>{new Date(lesson.publish_at).toLocaleDateString()}</span>
            )}
            {lesson.read_points > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-white/30">
                <Star className="h-3.5 w-3.5" />
                {t("lessons.points_pill", { points: lesson.read_points })}
              </span>
            )}
            {lesson.status !== "published" && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/80 ring-1 ring-white/25">
                {t("lessons.not_published")}
              </span>
            )}
          </div>
        </section>

        {lesson.body_md && (
          <div className="card card-pad mb-6">
            <Markdown>{lesson.body_md}</Markdown>
          </div>
        )}

        {visibleLinks.length > 0 && (
          <section className="mb-6">
            <h2 className="section-title mb-3">{t("lessons.related_title")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {visibleLinks.map((link) => {
                const isChallenge = !!link.challenge_id;
                const href = isChallenge
                  ? `/t/${slug}/challenges/${link.challenge_id}`
                  : `/t/${slug}/leaderboards/${link.leaderboard_id}`;
                const label = isChallenge
                  ? challengeById.get(link.challenge_id!)
                  : leaderboardById.get(link.leaderboard_id!);
                return (
                  <li key={link.id}>
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
                        {isChallenge ? (
                          <Target className="h-5 w-5" />
                        ) : (
                          <Trophy className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold tracking-tight">
                          {label}
                        </span>
                        <span className="block text-xs text-muted">
                          {isChallenge
                            ? t("lessons.related_kind_challenge")
                            : t("lessons.related_kind_leaderboard")}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {read ? (
          <p className="card card-pad mb-6 inline-flex items-center gap-3 text-sm font-semibold">
            <span
              className="grid h-9 w-9 place-items-center rounded-full"
              style={{
                background: "var(--success-bg)",
                color: "var(--success)",
              }}
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <span style={{ color: "var(--success-fg)" }}>
              {read.points_awarded > 0
                ? t("lessons.read_banner_points", {
                    date: new Date(read.read_at).toLocaleDateString(),
                    points: read.points_awarded,
                  })
                : t("lessons.read_banner", {
                    date: new Date(read.read_at).toLocaleDateString(),
                  })}
            </span>
          </p>
        ) : (
          isLive && (
            <section className="card card-pad mb-6">
              <h2 className="font-semibold tracking-tight">
                {t("lessons.read_task_title")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {lesson.read_points > 0
                  ? t("lessons.read_task_body_points", {
                      points: lesson.read_points,
                    })
                  : t("lessons.read_task_body")}
              </p>
              <div className="mt-4">
                <MarkReadButton
                  slug={slug}
                  lessonId={id}
                  strings={{
                    cta:
                      lesson.read_points > 0
                        ? t("lessons.mark_read_points", {
                            points: lesson.read_points,
                          })
                        : t("lessons.mark_read"),
                    pending: t("lessons.mark_read_pending"),
                  }}
                />
              </div>
            </section>
          )
        )}
      </main>
    </>
  );
}
