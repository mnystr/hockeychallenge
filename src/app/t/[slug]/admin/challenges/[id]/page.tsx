import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
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
      "id, title, description_md, completion_points, completion_mode, required_task_count, publish_at, starts_at, ends_at, recurrence, status",
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin/challenges`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Challenges
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">Edit challenge</h1>
        <ChallengeStatusButtons
          slug={slug}
          challengeId={id}
          status={challenge.status}
        />
      </div>

      <ChallengeForm slug={slug} challenge={challenge} />

      <hr className="my-10 border-gray-200" />

      <h2 className="mb-4 text-xl font-semibold">Tasks</h2>
      <TaskList slug={slug} challengeId={id} tasks={tasks ?? []} />
    </main>
  );
}
