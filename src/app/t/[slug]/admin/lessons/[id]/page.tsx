import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { markdownEditorStrings } from "@/lib/i18n/editor-strings";
import { Target, Trophy } from "@/components/icons";
import LessonForm from "./lesson-form";
import LessonStatusButtons from "./status-buttons";
import { addLessonLink, removeLessonLink } from "../actions";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
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
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, body_md, read_points, publish_at, status, card_theme")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lesson) notFound();

  // Everything needed for the related-content manager: current links plus
  // the team's challenges and leaderboards to offer in the add-select.
  const [{ data: links }, { data: audienceRows }, { data: leaderboards }] =
    await Promise.all([
      supabase
        .from("lesson_links")
        .select("id, challenge_id, leaderboard_id, position")
        .eq("lesson_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("challenge_audience")
        .select("challenge_id")
        .eq("team_id", ctx.teamId),
      supabase
        .from("leaderboards")
        .select("id, name")
        .eq("team_id", ctx.teamId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);

  const challengeIds = (audienceRows ?? []).map((r) => r.challenge_id);
  const { data: challenges } = challengeIds.length
    ? await supabase
        .from("challenges")
        .select("id, title")
        .in("id", challengeIds)
        .is("deleted_at", null)
        .order("title", { ascending: true })
    : { data: [] };

  const challengeById = new Map((challenges ?? []).map((c) => [c.id, c.title]));
  const leaderboardById = new Map(
    (leaderboards ?? []).map((l) => [l.id, l.name]),
  );

  const linkedChallengeIds = new Set(
    (links ?? []).map((l) => l.challenge_id).filter(Boolean),
  );
  const linkedLeaderboardIds = new Set(
    (links ?? []).map((l) => l.leaderboard_id).filter(Boolean),
  );
  const availableChallenges = (challenges ?? []).filter(
    (c) => !linkedChallengeIds.has(c.id),
  );
  const availableLeaderboards = (leaderboards ?? []).filter(
    (l) => !linkedLeaderboardIds.has(l.id),
  );

  const t = await getT();

  const formStrings = {
    title: t("admin.lessons.form.title"),
    body: t("admin.lessons.form.body"),
    body_hint: t("admin.lessons.form.body_hint"),
    read_points: t("admin.lessons.form.read_points"),
    read_points_hint: t("admin.lessons.form.read_points_hint"),
    publish_at: t("admin.lessons.form.publish_at"),
    publish_hint: t("admin.lessons.form.publish_hint"),
    saving: t("admin.lessons.form.saving"),
    save: t("admin.lessons.form.save"),
    saved: t("admin.lessons.form.saved"),
    card_theme_label: t("admin.lessons.form.card_theme_label"),
    card_theme_hint: t("admin.lessons.form.card_theme_hint"),
    card_theme_default: t("admin.challenges.form.card_theme_default"),
    card_theme_aurora: t("admin.challenges.form.card_theme_aurora"),
    card_theme_inferno: t("admin.challenges.form.card_theme_inferno"),
    card_theme_glacier: t("admin.challenges.form.card_theme_glacier"),
    card_theme_forest: t("admin.challenges.form.card_theme_forest"),
    card_theme_sunset: t("admin.challenges.form.card_theme_sunset"),
    card_theme_lightning: t("admin.challenges.form.card_theme_lightning"),
    card_theme_royal: t("admin.challenges.form.card_theme_royal"),
    card_theme_ocean: t("admin.challenges.form.card_theme_ocean"),
  };

  const editorStrings = markdownEditorStrings(t);

  const statusStrings = {
    publish: t("admin.lessons.publish"),
    unpublish: t("admin.lessons.unpublish"),
    archive: t("admin.lessons.archive"),
    move_to_draft: t("admin.lessons.move_to_draft"),
    delete: t("admin.lessons.delete"),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin/lessons`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("admin.lessons.edit_title")}
        </h1>
        <LessonStatusButtons
          slug={slug}
          lessonId={id}
          status={lesson.status}
          strings={statusStrings}
        />
      </div>

      <LessonForm
        slug={slug}
        lesson={lesson}
        strings={formStrings}
        editorStrings={editorStrings}
      />

      <hr className="my-10 border-[color:var(--border)]" />

      <h2 className="section-title mb-1">
        {t("admin.lessons.related_title")}
      </h2>
      <p className="mb-4 text-sm text-muted">
        {t("admin.lessons.related_intro")}
      </p>

      {links && links.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {links.map((link) => {
            const isChallenge = !!link.challenge_id;
            const label = isChallenge
              ? challengeById.get(link.challenge_id!) ??
                t("admin.lessons.related_missing")
              : leaderboardById.get(link.leaderboard_id!) ??
                t("admin.lessons.related_missing");
            return (
              <li
                key={link.id}
                className="card card-pad flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {isChallenge ? (
                    <Target className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <Trophy className="h-4 w-4 shrink-0 text-muted" />
                  )}
                  <span className="truncate font-semibold">{label}</span>
                  <span className="pill shrink-0">
                    {isChallenge
                      ? t("admin.lessons.related_kind_challenge")
                      : t("admin.lessons.related_kind_leaderboard")}
                  </span>
                </span>
                <form
                  action={async () => {
                    "use server";
                    await removeLessonLink(slug, id, link.id);
                  }}
                >
                  <button className="btn btn-ghost btn-sm">
                    {t("admin.lessons.related_remove")}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card card-pad mb-4 text-sm text-muted">
          {t("admin.lessons.related_empty")}
        </p>
      )}

      {(availableChallenges.length > 0 || availableLeaderboards.length > 0) && (
        <form
          action={async (formData: FormData) => {
            "use server";
            await addLessonLink(slug, id, formData);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="target" className="label">
              {t("admin.lessons.related_add_label")}
            </label>
            <select id="target" name="target" className="select" required>
              {availableChallenges.length > 0 && (
                <optgroup label={t("admin.lessons.related_kind_challenge")}>
                  {availableChallenges.map((c) => (
                    <option key={c.id} value={`c:${c.id}`}>
                      {c.title || t("admin.challenges.untitled")}
                    </option>
                  ))}
                </optgroup>
              )}
              {availableLeaderboards.length > 0 && (
                <optgroup label={t("admin.lessons.related_kind_leaderboard")}>
                  {availableLeaderboards.map((l) => (
                    <option key={l.id} value={`l:${l.id}`}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <button className="btn btn-secondary">
            {t("admin.lessons.related_add")}
          </button>
        </form>
      )}
    </main>
  );
}
