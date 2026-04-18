import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { revokeInvite } from "../actions";
import CreateInviteForm from "./create-form";

export default async function InvitesPage({
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
  const { data: invites } = await supabase
    .from("team_invites")
    .select("id, code, expires_at, max_uses, uses_count, revoked_at, created_at")
    .eq("team_id", ctx.teamId)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Invites</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Create an invite</h2>
        <CreateInviteForm slug={slug} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All invites</h2>
        {invites && invites.length > 0 ? (
          <ul className="space-y-3">
            {invites.map((inv) => {
              const expired =
                inv.expires_at !== null &&
                new Date(inv.expires_at).getTime() < Date.now();
              const maxed =
                inv.max_uses !== null && inv.uses_count >= inv.max_uses;
              const dead = inv.revoked_at !== null || expired || maxed;
              return (
                <li
                  key={inv.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    dead
                      ? "border-gray-200 bg-gray-50"
                      : "border-gray-300"
                  }`}
                >
                  <div>
                    <code className="font-mono font-medium">{inv.code}</code>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {inv.uses_count}
                      {inv.max_uses ? `/${inv.max_uses}` : ""} uses
                      {inv.expires_at &&
                        ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                      {inv.revoked_at && " · revoked"}
                      {!inv.revoked_at && expired && " · expired"}
                      {!inv.revoked_at && maxed && " · fully used"}
                    </div>
                  </div>
                  {!inv.revoked_at && !expired && !maxed && (
                    <form
                      action={async () => {
                        "use server";
                        await revokeInvite(slug, inv.id);
                      }}
                    >
                      <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Revoke
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No invites yet.</p>
        )}
      </section>
    </main>
  );
}
