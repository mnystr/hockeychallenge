import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";

export default async function LeaderboardsAdminListPage({
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
  const { data: boards } = await supabase
    .from("leaderboards")
    .select("id, name, kind, status, starts_at, ends_at, updated_at")
    .eq("team_id", ctx.teamId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leaderboards</h1>
        <Link
          href={`/t/${slug}/admin/leaderboards/new`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          New leaderboard
        </Link>
      </div>

      {boards && boards.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/t/${slug}/admin/leaderboards/${b.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {b.kind}
                    {b.ends_at &&
                      ` · ends ${new Date(b.ends_at).toLocaleDateString()}`}
                    {" · updated "}
                    {new Date(b.updated_at).toLocaleString()}
                  </div>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No leaderboards yet.</p>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
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
