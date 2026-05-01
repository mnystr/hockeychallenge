import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import ChallengeForm from "./challenge-form";
import TaskList from "./task-list";
import ChallengeStatusButtons from "./status-buttons";

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  try {
    await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unauthorized") redirect("/login");
    if (msg === "team not found") notFound();
    redirect(`/t/${slug}`);
  }

  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, title, description_md, completion_points, completion_mode, required_task_count, publish_at, starts_at, ends_at, recurrence, status, card_theme",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!challenge) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description_md, points, target_count, position")
    .eq("challenge_id", id)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const t = await getT();

  const formStrings = {
    title: t("admin.challenges.form.title"),
    description: t("admin.challenges.form.description"),
    description_hint: t("admin.challenges.form.description_hint"),
    completion_mode: t("admin.challenges.form.completion_mode"),
    mode_all: t("admin.challenges.form.mode_all"),
    mode_xy: t("admin.challenges.form.mode_xy"),
    required_count: t("admin.challenges.form.required_count"),
    points_optional: t("admin.challenges.form.points_optional"),
    points_hint: t("admin.challenges.form.points_hint"),
    recurrence: t("admin.challenges.form.recurrence"),
    recurrence_none: t("admin.challenges.form.recurrence_none"),
    recurrence_weekly: t("admin.challenges.form.recurrence_weekly"),
    recurrence_monthly: t("admin.challenges.form.recurrence_monthly"),
    publish_at: t("admin.challenges.form.publish_at"),
    publish_hint: t("admin.challenges.form.publish_hint"),
    starts_at: t("admin.challenges.form.starts_at"),
    ends_at: t("admin.challenges.form.ends_at"),
    saving: t("admin.challenges.form.saving"),
    save: t("admin.challenges.form.save"),
    saved: t("admin.challenges.form.saved"),
    card_theme_label: t("admin.challenges.form.card_theme_label"),
    card_theme_hint: t("admin.challenges.form.card_theme_hint"),
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

  const taskStrings = {
    // Plain templates so we can pass them through the server→client boundary.
    // The client interpolates {target}/{points} at render time.
    target_template: t("admin.challenges.tasks.target"),
    pts_template: t("admin.challenges.tasks.pts"),
    edit: t("admin.challenges.tasks.edit"),
    remove: t("admin.challenges.tasks.remove"),
    saving: t("admin.challenges.tasks.saving"),
    save: t("admin.challenges.tasks.save"),
    cancel: t("admin.challenges.tasks.cancel"),
    add_a_task: t("admin.challenges.tasks.add_a_task"),
    adding: t("admin.challenges.tasks.adding"),
    add_task: t("admin.challenges.tasks.add_task"),
    task_title: t("admin.challenges.tasks.task_title"),
    description_optional: t("admin.challenges.tasks.description_optional"),
    target_count: t("admin.challenges.tasks.target_count"),
    points_optional: t("admin.challenges.tasks.points_optional"),
  };

  const statusStrings = {
    publish: t("admin.challenges.publish"),
    unpublish: t("admin.challenges.unpublish"),
    archive: t("admin.challenges.archive"),
    move_to_draft: t("admin.challenges.move_to_draft"),
    delete: t("admin.challenges.delete"),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin/challenges`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("admin.challenges.edit_title")}
        </h1>
        <ChallengeStatusButtons
          slug={slug}
          challengeId={id}
          status={challenge.status}
          strings={statusStrings}
        />
      </div>

      <ChallengeForm slug={slug} challenge={challenge} strings={formStrings} />

      <hr className="my-10 border-[color:var(--border)]" />

      <h2 className="section-title mb-3">{t("admin.challenges.tasks_title")}</h2>
      <TaskList
        slug={slug}
        challengeId={id}
        tasks={tasks ?? []}
        strings={taskStrings}
      />
    </main>
  );
}
