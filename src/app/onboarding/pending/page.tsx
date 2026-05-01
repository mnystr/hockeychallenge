import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

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

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="card card-pad-lg">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight">
          {t("onboarding.pending_title")}
        </h1>
        <p className="mb-6 text-sm text-muted">{t("onboarding.pending_intro")}</p>

        {memberships.data && memberships.data.length > 0 && (
          <section className="mb-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
            <h2 className="section-title mb-2">
              {t("onboarding.pending_memberships")}
            </h2>
            <ul className="space-y-1 text-sm">
              {memberships.data.map((m) => {
                const teamName =
                  (m.teams as unknown as { name: string } | null)?.name ?? "Team";
                return (
                  <li key={m.team_id} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--ui-primary)" }}
                    />
                    {teamName}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {teamRequests.data && teamRequests.data.length > 0 && (
          <section className="mb-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
            <h2 className="section-title mb-2">
              {t("onboarding.pending_team_requests")}
            </h2>
            <ul className="space-y-1 text-sm">
              {teamRequests.data.map((r) => (
                <li key={r.proposed_name} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--ui-accent)" }}
                  />
                  {r.proposed_name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <form action="/logout" method="post" className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm text-muted-2 hover:text-app-fg hover:underline"
        >
          {t("common.sign_out")}
        </button>
      </form>
    </main>
  );
}
