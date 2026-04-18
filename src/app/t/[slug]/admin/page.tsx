import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";

export default async function TeamAdminDashboard({
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
  const [pendingCount, activeInvites, challengeCount, leaderboardCount] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("team_id", ctx.teamId)
        .eq("status", "pending")
        .is("deleted_at", null),
      supabase
        .from("team_invites")
        .select("id", { count: "exact", head: true })
        .eq("team_id", ctx.teamId)
        .is("revoked_at", null),
      supabase
        .from("challenge_audience")
        .select("challenge_id", { count: "exact", head: true })
        .eq("team_id", ctx.teamId),
      supabase
        .from("leaderboards")
        .select("id", { count: "exact", head: true })
        .eq("team_id", ctx.teamId)
        .is("deleted_at", null),
    ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        {ctx.teamName}
      </p>
      <h1 className="mb-6 text-3xl font-bold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/t/${slug}/admin/approvals`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Approvals</div>
          <div className="mt-1 text-sm text-gray-500">
            {pendingCount.count ?? 0} pending
          </div>
        </Link>
        <Link
          href={`/t/${slug}/admin/invites`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Invites</div>
          <div className="mt-1 text-sm text-gray-500">
            {activeInvites.count ?? 0} active
          </div>
        </Link>
        <Link
          href={`/t/${slug}/admin/challenges`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Challenges</div>
          <div className="mt-1 text-sm text-gray-500">
            {challengeCount.count ?? 0} total
          </div>
        </Link>
        <Link
          href={`/t/${slug}/admin/leaderboards`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Leaderboards</div>
          <div className="mt-1 text-sm text-gray-500">
            {leaderboardCount.count ?? 0} total
          </div>
        </Link>
      </div>

      <Link
        href={`/t/${slug}`}
        className="mt-8 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Back to team page
      </Link>
    </main>
  );
}
