import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Check, Sparkles, Target } from "@/components/icons";
import { isChallengeCardTheme } from "@/lib/challenges/card-themes";
import TeamShell from "@/components/TeamShell";

export default async function ChallengesListPage({
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
    .select("role, status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership || membership.status !== "active") {
    redirect(`/t/${slug}`);
  }

  const { data: audienceRows } = await supabase
    .from("challenge_audience")
    .select("challenge_id")
    .eq("team_id", team.id);
  const ids = (audienceRows ?? []).map((r) => r.challenge_id);

  const { data: challenges } = ids.length
    ? await supabase
        .from("challenges")
        .select(
          "id, title, ends_at, starts_at, completion_mode, required_task_count, card_theme, updated_at",
        )
        .in("id", ids)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  type ChallengeRow = {
    id: string;
    title: string;
    ends_at: string | null;
    starts_at: string | null;
    completion_mode: "all_tasks" | "x_of_y";
    required_task_count: number | null;
    card_theme: string | null;
    updated_at: string;
  };
  const challengeRows = (challenges ?? []) as ChallengeRow[];
  const challengeIds = challengeRows.map((c) => c.id);

  // Pull tasks + the user's progress for every visible challenge so we can
  // render a "X / Y tasks" progress strip on each card without making the
  // user click through to discover progress.
  const [{ data: tasks }, { data: progress }, { data: completions }] =
    await Promise.all([
      challengeIds.length
        ? supabase
            .from("tasks")
            .select("id, challenge_id, target_count")
            .in("challenge_id", challengeIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] as Array<{
            id: string;
            challenge_id: string;
            target_count: number;
          }> }),
      challengeIds.length
        ? supabase
            .from("task_progress")
            .select("task_id, count")
            .eq("user_id", user.id)
            .in(
              "task_id",
              // Defer to a later filter once we have the task list — see below.
              [],
            )
        : Promise.resolve({ data: [] as Array<{
            task_id: string;
            count: number;
          }> }),
      challengeIds.length
        ? supabase
            .from("challenge_completions")
            .select("challenge_id")
            .in("challenge_id", challengeIds)
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] as Array<{ challenge_id: string }> }),
    ]);

  const taskRows = tasks ?? [];
  const taskIds = taskRows.map((t) => t.id);
  // Re-fetch progress with the actual task_ids — the parallel fetch
  // above only kicked off when challengeIds was non-empty; we still
  // need the right `in()` filter to get any rows back.
  const realProgress = taskIds.length
    ? (
        await supabase
          .from("task_progress")
          .select("task_id, count")
          .eq("user_id", user.id)
          .in("task_id", taskIds)
      ).data ?? []
    : (progress ?? []);

  const progressByTask = new Map<string, number>();
  for (const p of realProgress) progressByTask.set(p.task_id, p.count);
  const tasksByChallenge = new Map<string, typeof taskRows>();
  for (const tk of taskRows) {
    const arr = tasksByChallenge.get(tk.challenge_id) ?? [];
    arr.push(tk);
    tasksByChallenge.set(tk.challenge_id, arr);
  }
  const completedIds = new Set(
    (completions ?? []).map((c) => c.challenge_id),
  );

  const t = await getT();

  return (
    <>
      <TeamShell slug={slug} active="challenges" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background:
                "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
              color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
            }}
          >
            <Target className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("challenges.list_title")}
          </h1>
        </header>

      {challengeRows.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {challengeRows.map((c) => {
            const tasksForChallenge = tasksByChallenge.get(c.id) ?? [];
            const totalTasks = tasksForChallenge.length;
            const tasksMet = tasksForChallenge.filter(
              (task) =>
                (progressByTask.get(task.id) ?? 0) >= task.target_count,
            ).length;
            const requiredTasks =
              c.completion_mode === "x_of_y"
                ? c.required_task_count ?? totalTasks
                : totalTasks;
            const pct =
              requiredTasks > 0
                ? Math.min(100, Math.round((tasksMet / requiredTasks) * 100))
                : 0;
            const isComplete = completedIds.has(c.id);
            const startsPending = !!(
              c.starts_at && new Date(c.starts_at) > new Date()
            );
            const hasEnded = !!(
              c.ends_at && new Date(c.ends_at) < new Date()
            );
            const themeAttr = isChallengeCardTheme(c.card_theme)
              ? c.card_theme
              : undefined;
            return (
              <li key={c.id}>
                <Link
                  href={`/t/${slug}/challenges/${c.id}`}
                  className="challenge-card"
                  data-theme={themeAttr}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {c.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {isComplete && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
                          style={{ color: "var(--success-fg)" }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {t("challenges.complete_badge")}
                        </span>
                      )}
                      {startsPending && (
                        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white ring-1 ring-white/30">
                          {t("challenges.started_not_yet")}
                        </span>
                      )}
                      {hasEnded && !isComplete && (
                        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/80 ring-1 ring-white/25">
                          {t("challenges.ended")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs/relaxed text-white/85 sm:text-sm/relaxed">
                    {c.starts_at && (
                      <span>
                        {new Date(c.starts_at).toLocaleDateString()}
                      </span>
                    )}
                    {c.ends_at && (
                      <>
                        {c.starts_at && <span>—</span>}
                        <span>
                          {new Date(c.ends_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                    {totalTasks > 0 && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold uppercase tracking-wider ring-1 ring-white/30">
                        {tasksMet}/{requiredTasks}{" "}
                        {t("challenges.tasks_title").toLowerCase()}
                      </span>
                    )}
                  </div>

                  {totalTasks > 0 && (
                    <div className="mt-4 max-w-xl">
                      <div className="challenge-card-progress">
                        <div
                          className={`progress-fill ${pct >= 100 || isComplete ? "is-complete" : ""}`}
                          style={{
                            width: `${isComplete ? 100 : pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {totalTasks === 0 && !isComplete && (
                    <div className="mt-3 flex items-center gap-2 text-sm font-medium text-white/85">
                      <Check className="h-4 w-4" />
                      {t("challenges.no_tasks")}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card card-pad text-sm text-muted">
          {t("challenges.empty")}
        </p>
      )}
      </main>
    </>
  );
}
