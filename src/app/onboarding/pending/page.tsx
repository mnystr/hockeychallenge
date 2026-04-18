import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth/session";

export default async function PendingPage() {
  const session = await getSessionState();

  if (session.kind === "anonymous") redirect("/login");
  if (session.kind === "has_memberships") {
    redirect(`/t/${session.defaultTeamSlug}`);
  }
  if (!session.hasPendingMembership && !session.hasPendingTeamRequest) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const [memberships, teamRequests] = await Promise.all([
    supabase
      .from("memberships")
      .select("team_id, teams(name)")
      .eq("user_id", session.userId)
      .eq("status", "pending")
      .is("deleted_at", null),
    supabase
      .from("team_creation_requests")
      .select("proposed_name, created_at")
      .eq("requested_by", session.userId)
      .eq("status", "pending"),
  ]);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Almost there</h1>
      <p className="mb-6 text-sm text-gray-500">
        Waiting for approval. You&apos;ll be able to see the team page once an
        admin approves. Feel free to close this tab — nothing more to do for now.
      </p>

      {memberships.data && memberships.data.length > 0 && (
        <section className="mb-6 rounded-md border border-gray-200 p-4">
          <h2 className="mb-2 font-semibold">Pending team applications</h2>
          <ul className="space-y-1 text-sm">
            {memberships.data.map((m) => {
              const teamName = (m.teams as unknown as { name: string } | null)?.name ?? "Team";
              return <li key={m.team_id}>• {teamName}</li>;
            })}
          </ul>
        </section>
      )}

      {teamRequests.data && teamRequests.data.length > 0 && (
        <section className="mb-6 rounded-md border border-gray-200 p-4">
          <h2 className="mb-2 font-semibold">Pending team-creation requests</h2>
          <ul className="space-y-1 text-sm">
            {teamRequests.data.map((r) => (
              <li key={r.proposed_name}>• {r.proposed_name}</li>
            ))}
          </ul>
        </section>
      )}

      <form action="/logout" method="post" className="text-center">
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
