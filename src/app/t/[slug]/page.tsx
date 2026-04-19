import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slug, status")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();

  const [{ data: appUser }, { data: membership }] = await Promise.all([
    supabase
      .from("app_users")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("team_id", team.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const isSuperAdmin = appUser?.is_super_admin ?? false;
  const isTeamAdmin =
    membership?.role === "team_admin" && membership?.status === "active";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          {team.status === "orphaned" && (
            <p className="mt-1 text-sm text-amber-600">
              This team has no active admin.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Super-admin
            </Link>
          )}
          {(isTeamAdmin || isSuperAdmin) && (
            <Link
              href={`/t/${slug}/admin`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      <nav className="grid gap-3 sm:grid-cols-3">
        <Link
          href={`/t/${slug}/challenges`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Challenges</div>
          <div className="mt-1 text-sm text-gray-500">
            Log progress and complete tasks.
          </div>
        </Link>
        <Link
          href={`/t/${slug}/leaderboards`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Leaderboards</div>
          <div className="mt-1 text-sm text-gray-500">
            See where you stand.
          </div>
        </Link>
        <Link
          href={`/t/${slug}/profile`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">Profile</div>
          <div className="mt-1 text-sm text-gray-500">
            Name, jersey number, visibility.
          </div>
        </Link>
      </nav>

      <form action="/logout" method="post" className="mt-10">
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
