import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import TaskProgress from "./task-progress";

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
      "id, title, description_md, completion_points, completion_mode, required_task_count, starts_at, ends_at, status",
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

  const tpStrings = {
    mark_done: t("challenges.mark_done"),
    done: t("challenges.done"),
    target_met: t("challenges.target_met"),
    target_units: (target: number) =>
      t("challenges.target_units", { target }),
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}/challenges`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        {t("challenges.back_to_challenges")}
      </Link>
      <h1 className="text-3xl font-bold">{challenge.title}</h1>
      <div className="mt-1 text-xs text-gray-500">
        {challenge.starts_at && (
          <>{new Date(challenge.starts_at).toLocaleDateString()} </>
        )}
        {challenge.ends_at && (
          <>· {new Date(challenge.ends_at).toLocaleDateString()}</>
        )}
      </div>

      {completion && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("challenges.completed_banner", {
            date: new Date(completion.completed_at).toLocaleDateString(),
            points: completion.points_awarded,
          })}
        </p>
      )}
      {startsPending && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {t("challenges.started_not_yet")}
        </p>
      )}
      {hasEnded && !completion && (
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {t("challenges.ended")}
        </p>
      )}

      {challenge.description_md && (
        <article className="prose prose-sm mt-6 max-w-none text-gray-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {challenge.description_md}
          </ReactMarkdown>
        </article>
      )}

      <h2 className="mt-8 mb-3 text-xl font-semibold">
        {t("challenges.tasks_title")}{" "}
        {challenge.completion_mode === "x_of_y" && (
          <span className="text-sm font-normal text-gray-500">
            {t("challenges.tasks_x_of_y", {
              required: challenge.required_task_count ?? 0,
              total: (tasks ?? []).length,
            })}
          </span>
        )}
      </h2>
      {tasks && tasks.length > 0 ? (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-md border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium">{task.title}</div>
                  {task.description_md && (
                    <div className="prose prose-sm mt-1 max-w-none text-gray-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {task.description_md}
                      </ReactMarkdown>
                    </div>
                  )}
                  {task.points !== null && (
                    <div className="mt-1 text-xs text-gray-500">
                      {t("challenges.points_per", { points: task.points })}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <TaskProgress
                  slug={slug}
                  challengeId={id}
                  taskId={task.id}
                  currentCount={progressByTask.get(task.id) ?? 0}
                  targetCount={task.target_count}
                  locked={!!(startsPending || hasEnded)}
                  strings={{
                    mark_done: tpStrings.mark_done,
                    done: tpStrings.done,
                    target_met: tpStrings.target_met,
                    target_units: tpStrings.target_units(task.target_count),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{t("challenges.no_tasks")}</p>
      )}
    </main>
  );
}
