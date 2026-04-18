import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { approveMembership, rejectMembership } from "../actions";

export default async function ApprovalsPage({
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
  const { data: pending } = await supabase
    .from("memberships")
    .select("id, user_id, created_at, profiles(display_name, jersey_number, pronouns)")
    .eq("team_id", ctx.teamId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Pending approvals</h1>

      {pending && pending.length > 0 ? (
        <ul className="space-y-3">
          {pending.map((m) => {
            const profile = (
              m.profiles as unknown as {
                display_name: string;
                jersey_number: number | null;
                pronouns: string | null;
              } | null
            );
            return (
              <li
                key={m.id}
                className="flex flex-col gap-3 rounded-md border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {profile?.display_name ?? "(no profile)"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {profile?.jersey_number !== null &&
                    profile?.jersey_number !== undefined
                      ? `#${profile.jersey_number}`
                      : "No jersey number"}
                    {profile?.pronouns ? ` · ${profile.pronouns}` : ""}
                    {" · applied "}
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await approveMembership(slug, m.id);
                    }}
                  >
                    <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                      Approve
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await rejectMembership(slug, m.id, null);
                    }}
                  >
                    <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nothing pending.</p>
      )}
    </main>
  );
}
