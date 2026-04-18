import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import LeaderboardForm from "../form";
import {
  archiveLeaderboardAction,
  softDeleteLeaderboard,
} from "../actions";

export default async function EditLeaderboardPage({
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
  const { data: leaderboard } = await supabase
    .from("leaderboards")
    .select(
      "id, name, description, kind, sort_order, unit, starts_at, ends_at, status",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!leaderboard) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin/leaderboards`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Leaderboards
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">Edit leaderboard</h1>
        <div className="flex flex-wrap gap-2">
          {leaderboard.status === "active" && (
            <form
              action={async () => {
                "use server";
                await archiveLeaderboardAction(slug, id);
              }}
            >
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                Archive
              </button>
            </form>
          )}
          {leaderboard.status === "archived" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              archived
            </span>
          )}
          <form
            action={async () => {
              "use server";
              await softDeleteLeaderboard(slug, id);
            }}
          >
            <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              Delete
            </button>
          </form>
        </div>
      </div>

      <LeaderboardForm slug={slug} leaderboard={leaderboard} />
    </main>
  );
}
