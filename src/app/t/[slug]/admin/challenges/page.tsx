import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { createChallengeDraft } from "./actions";

export default async function ChallengesAdminListPage({
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

  const { data: challenges } = challengeIds.length
    ? await supabase
        .from("challenges")
        .select("id, title, status, publish_at, starts_at, ends_at, updated_at")
        .in("id", challengeIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Challenges</h1>
        <form
          action={async () => {
            "use server";
            await createChallengeDraft(slug);
          }}
        >
          <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            New challenge
          </button>
        </form>
      </div>

      {challenges && challenges.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {challenges.map((c) => (
            <li key={c.id}>
              <Link
                href={`/t/${slug}/admin/challenges/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{c.title || "(untitled)"}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    Updated {new Date(c.updated_at).toLocaleString()}
                    {c.ends_at &&
                      ` · ends ${new Date(c.ends_at).toLocaleDateString()}`}
                  </div>
                </div>
                <StatusBadge status={c.status} />
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    published: "bg-green-100 text-green-700",
    archived: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}
