import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import TaskProgress from "./task-progress";
import { ChevronLeft, Check, Sparkles } from "@/components/icons";
import { isChallengeCardTheme } from "@/lib/challenges/card-themes";
import TeamShell from "@/components/TeamShell";

export default async function ChallengeDetailPage({
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

  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, title, description_md, completion_points, completion_mode, required_task_count, starts_at, ends_at, status, card_theme",
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

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: progress } = taskIds.length
    ? await supabase
        .from("task_progress")
        .select("task_id, count")
        .eq("user_id", user.id)
        .in("task_id", taskIds)
    : { data: [] };
  const progressByTask = new Map<string, number>();
  for (const p of progress ?? []) {
    progressByTask.set(p.task_id, p.count);
  }

  const { data: completion } = await supabase
    .from("challenge_completions")
    .select("points_awarded, completed_at")
    .eq("challenge_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const startsPending =
    challenge.starts_at && new Date(challenge.starts_at) > new Date();
  const hasEnded =
    challenge.ends_at && new Date(challenge.ends_at) < new Date();

  const t = await getT();

  // Compute completion percentage across tasks for the meta row.
  const totalTasks = (tasks ?? []).length;
  const tasksMet = (tasks ?? []).filter(
    (task) => (progressByTask.get(task.id) ?? 0) >= task.target_count,
  ).length;
  const requiredTasks =
    challenge.completion_mode === "x_of_y"
      ? challenge.required_task_count ?? totalTasks
      : totalTasks;
  const challengeProgress =
    requiredTasks > 0
      ? Math.min(100, Math.round((tasksMet / requiredTasks) * 100))
      : 0;

  return (
    <>
    <TeamShell slug={slug} active="challenges" />
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        href={`/t/${slug}/challenges`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ui-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("challenges.back_to_challenges")}
      </Link>

      <section
        className="challenge-card mb-6"
        data-theme={
          isChallengeCardTheme(challenge.card_theme)
            ? challenge.card_theme
            : undefined
        }
      >
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {challenge.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/85">
          {challenge.starts_at && (
            <span>{new Date(challenge.starts_at).toLocaleDateString()}</span>
          )}
          {challenge.ends_at && (
            <>
              <span>—</span>
              <span>{new Date(challenge.ends_at).toLocaleDateString()}</span>
            </>
          )}
          {totalTasks > 0 && (
            <span
              className="pill"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.35)",
              }}
            >
              {tasksMet}/{requiredTasks} {t("challenges.tasks_title").toLowerCase()}
            </span>
          )}
        </div>
        {totalTasks > 0 && (
          <div className="mt-4 max-w-md">
            <div
              className="progress"
              style={{
                background: "rgba(255,255,255,0.2)",
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <div
                className={`progress-fill ${challengeProgress >= 100 ? "is-complete" : ""}`}
                style={{ width: `${challengeProgress}%`, background: "#fff" }}
              />
            </div>
          </div>
        )}
      </section>

      {completion && (
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
            {t("challenges.completed_banner", {
              date: new Date(completion.completed_at).toLocaleDateString(),
              points: completion.points_awarded,
            })}
          </span>
        </p>
      )}
      {startsPending && (
        <p className="pill pill-warning mb-6 px-3 py-2">
          {t("challenges.started_not_yet")}
        </p>
      )}
      {hasEnded && !completion && (
        <p className="pill mb-6 px-3 py-2">{t("challenges.ended")}</p>
      )}

      {challenge.description_md && (
        <div className="card card-pad mb-6">
          <article className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {challenge.description_md}
            </ReactMarkdown>
          </article>
        </div>
      )}

      <h2 className="section-title mb-3">
        {t("challenges.tasks_title")}{" "}
        {challenge.completion_mode === "x_of_y" && (
          <span className="ml-1 normal-case tracking-normal text-muted-2">
            {t("challenges.tasks_x_of_y", {
              required: challenge.required_task_count ?? 0,
              total: (tasks ?? []).length,
            })}
          </span>
        )}
      </h2>
      {tasks && tasks.length > 0 ? (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const cur = progressByTask.get(task.id) ?? 0;
            const met = cur >= task.target_count;
            return (
              <li
                key={task.id}
                className={`card card-pad ${met ? "ring-1" : ""}`}
                style={
                  met
                    ? {
                        boxShadow:
                          "0 0 0 1px color-mix(in oklab, var(--success) 35%, transparent), var(--shadow-sm)",
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {met && (
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                          style={{
                            background: "var(--success-bg)",
                            color: "var(--success)",
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                      <div className="font-semibold tracking-tight">
                        {task.title}
                      </div>
                    </div>
                    {task.description_md && (
                      <div className="md mt-2 text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {task.description_md}
                        </ReactMarkdown>
                      </div>
                    )}
                    {task.points !== null && (
                      <div className="mt-2 text-xs text-muted">
                        {t("challenges.points_per", { points: task.points })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <TaskProgress
                    slug={slug}
                    challengeId={id}
                    taskId={task.id}
                    currentCount={cur}
                    targetCount={task.target_count}
                    locked={!!(startsPending || hasEnded)}
                    strings={{
                      mark_done: t("challenges.mark_done"),
                      done: t("challenges.done"),
                      target_met: t("challenges.target_met"),
                      add_one: t("challenges.add_one"),
                      submit_partial: t("challenges.submit_partial"),
                      progress_label: t("challenges.progress_label"),
                      add_x_label: t("challenges.add_x_label"),
                      add: t("challenges.add"),
                      set_label: t("challenges.set_label"),
                      set: t("challenges.set"),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card card-pad text-sm text-muted">
          {t("challenges.no_tasks")}
        </p>
      )}
    </main>
    </>
  );
}
