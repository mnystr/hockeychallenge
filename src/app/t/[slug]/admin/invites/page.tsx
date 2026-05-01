import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
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

  const t = await getT();
  // Server-component render is request-scoped, so Date.now() is fine here.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const formStrings = {
    code_optional: t("admin.invites.code_optional"),
    auto_generated: t("admin.invites.auto_generated"),
    expires_in_days: t("admin.invites.expires_in_days"),
    max_uses: t("admin.invites.max_uses"),
    creating: t("admin.invites.creating"),
    create_invite: t("admin.invites.create_invite"),
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        {t("admin.invites.title")}
      </h1>

      <section className="mb-8">
        <h2 className="section-title mb-3">
          {t("admin.invites.create_an_invite")}
        </h2>
        <CreateInviteForm slug={slug} strings={formStrings} />
      </section>

      <section>
        <h2 className="section-title mb-3">{t("admin.invites.all_invites")}</h2>
        {invites && invites.length > 0 ? (
          <ul className="space-y-3">
            {invites.map((inv) => {
              const expired =
                inv.expires_at !== null &&
                new Date(inv.expires_at).getTime() < nowMs;
              const maxed =
                inv.max_uses !== null && inv.uses_count >= inv.max_uses;
              const dead = inv.revoked_at !== null || expired || maxed;
              return (
                <li
                  key={inv.id}
                  className="card card-pad flex items-center justify-between gap-3"
                  style={
                    dead
                      ? { background: "var(--surface-2)" }
                      : undefined
                  }
                >
                  <div className="min-w-0">
                    <code className="mono font-semibold tracking-tight">
                      {inv.code}
                    </code>
                    <div className="mt-0.5 text-xs text-muted">
                      {t("admin.invites.uses", {
                        count: inv.uses_count,
                        maxUses: inv.max_uses ?? "∞",
                      })}
                      {inv.expires_at &&
                        ` · ${t("admin.invites.expires", {
                          date: new Date(inv.expires_at).toLocaleDateString(),
                        })}`}
                      {inv.revoked_at && ` · ${t("admin.invites.revoked")}`}
                      {!inv.revoked_at && expired &&
                        ` · ${t("admin.invites.expired")}`}
                      {!inv.revoked_at && maxed &&
                        ` · ${t("admin.invites.fully_used")}`}
                    </div>
                  </div>
                  {!inv.revoked_at && !expired && !maxed && (
                    <form
                      action={async () => {
                        "use server";
                        await revokeInvite(slug, inv.id);
                      }}
                    >
                      <button className="btn btn-secondary btn-sm">
                        {t("admin.invites.revoke")}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card card-pad text-sm text-muted">
            {t("admin.invites.empty")}
          </p>
        )}
      </section>
    </main>
  );
}
