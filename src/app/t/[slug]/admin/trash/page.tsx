import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { restoreChallenge, restoreLeaderboard } from "./actions";

export default async function TrashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { data: audienceRows } = await supabase
    .from("challenge_audience")
    .select("challenge_id")
    .eq("team_id", ctx.teamId);
  const challengeIds = (audienceRows ?? []).map((r) => r.challenge_id);

  const { data: deletedChallenges } = challengeIds.length
    ? await supabase
        .from("challenges")
        .select("id, title, deleted_at")
        .in("id", challengeIds)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
    : { data: [] };

  const { data: deletedLeaderboards } = await supabase
    .from("leaderboards")
    .select("id, name, kind, deleted_at")
    .eq("team_id", ctx.teamId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const anything =
    (deletedChallenges && deletedChallenges.length > 0) ||
    (deletedLeaderboards && deletedLeaderboards.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <h1 className="mb-1 text-3xl font-bold">Trash</h1>
      <p className="mb-6 text-sm text-gray-500">
        Soft-deleted items can be restored here. Nothing is permanently
        removed from this UI.
      </p>

      {deletedChallenges && deletedChallenges.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Challenges</h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {deletedChallenges.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{c.title || "(untitled)"}</div>
                  <div className="text-xs text-gray-500">
                    Deleted {new Date(c.deleted_at!).toLocaleString()}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await restoreChallenge(slug, c.id);
                  }}
                >
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deletedLeaderboards && deletedLeaderboards.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Leaderboards</h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {deletedLeaderboards.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-gray-500">
                    {l.kind} · deleted {new Date(l.deleted_at!).toLocaleString()}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await restoreLeaderboard(slug, l.id);
                  }}
                >
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!anything && <p className="text-sm text-gray-500">Trash is empty.</p>}
    </main>
  );
}
