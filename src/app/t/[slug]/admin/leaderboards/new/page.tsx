import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTeamAdmin } from "@/lib/auth/session";
import LeaderboardForm from "../form";

export default async function NewLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unauthorized") redirect("/login");
    if (msg === "team not found") notFound();
    redirect(`/t/${slug}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin/leaderboards`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Leaderboards
      </Link>
      <h1 className="mb-6 text-3xl font-bold">New leaderboard</h1>
      <LeaderboardForm slug={slug} />
    </main>
  );
}
