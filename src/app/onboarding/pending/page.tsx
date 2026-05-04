import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shield } from "@/components/icons";

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
      {session.kind === "no_memberships" && session.isSuperAdmin && (
        <section className="card card-pad mb-6">
          <div className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
                color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
              }}
            >
              <Shield className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-tight">
                {t("onboarding.superadmin_banner_title")}
              </div>
              <p className="text-sm text-muted">
                {t("onboarding.superadmin_banner_body")}
              </p>
              <Link href="/admin" className="btn btn-primary btn-sm mt-3">
                {t("onboarding.superadmin_link")}
              </Link>
            </div>
          </div>
        </section>
      )}

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
