import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Must be a member of the team to see challenges.
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

  // Challenges in this team's audience. RLS filters publish_at and status.
  const { data: audienceRows } = await supabase
    .from("challenge_audience")
    .select("challenge_id")
    .eq("team_id", team.id);
  const ids = (audienceRows ?? []).map((r) => r.challenge_id);

  const { data: challenges } = ids.length
    ? await supabase
        .from("challenges")
        .select("id, title, ends_at, updated_at")
        .in("id", ids)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const challengeIds = (challenges ?? []).map((c) => c.id);
  const { data: completions } = challengeIds.length
    ? await supabase
        .from("challenge_completions")
        .select("challenge_id")
        .in("challenge_id", challengeIds)
        .eq("user_id", user.id)
    : { data: [] };
  const completedIds = new Set((completions ?? []).map((c) => c.challenge_id));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← {team.name}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Challenges</h1>

      {challenges && challenges.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {challenges.map((c) => (
            <li key={c.id}>
              <Link
                href={`/t/${slug}/challenges/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{c.title}</div>
                  {c.ends_at && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      Ends {new Date(c.ends_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {completedIds.has(c.id) && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Complete
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No challenges yet.</p>
      )}
    </main>
  );
}
