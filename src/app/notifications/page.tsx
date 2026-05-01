import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Bell, ChevronLeft } from "@/components/icons";
import { markAllRead, markOneRead } from "./actions";
import PreferencesForm from "./preferences-form";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: notifications }, { data: prefs }, { data: teams }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("id, team_id, kind, payload, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("notification_preferences")
        .select(
          "team_id, email_new_challenge, email_leaderboard_passed, email_approval_needed, in_app_new_challenge, in_app_leaderboard_passed",
        )
        .eq("user_id", user.id),
      supabase
        .from("memberships")
        .select("team_id, teams!inner(id, name, slug)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("deleted_at", null),
    ]);

  const teamsById = new Map<string, { name: string; slug: string }>();
  for (const m of teams ?? []) {
    const tInfo = m.teams as unknown as { id: string; name: string; slug: string };
    teamsById.set(tInfo.id, { name: tInfo.name, slug: tInfo.slug });
  }

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ui-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("common.back_home")}
      </Link>
      <header className="mb-6 flex items-center gap-3">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl"
          style={{
            background: "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
            color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
          }}
        >
          <Bell className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("notifications.title")}
        </h1>
      </header>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">{t("notifications.recent")}</h2>
          {(notifications ?? []).some((n) => !n.read_at) && (
            <form
              action={async () => {
                "use server";
                await markAllRead();
              }}
            >
              <button className="text-sm font-semibold text-ui-primary hover:underline">
                {t("notifications.mark_all_read")}
              </button>
            </form>
          )}
        </div>
        {notifications && notifications.length > 0 ? (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const team = n.team_id ? teamsById.get(n.team_id) : null;
              const href = renderLink(n, team?.slug ?? null);
              const unread = !n.read_at;
              const title = renderTitle(t, n);
              const kindLabel = t(`notifications.kinds.${n.kind}`);
              return (
                <li
                  key={n.id}
                  className="card card-pad flex items-center justify-between gap-3 text-sm"
                  style={
                    unread
                      ? {
                          borderColor:
                            "color-mix(in oklab, var(--ui-primary) 45%, transparent)",
                          background:
                            "linear-gradient(90deg, color-mix(in oklab, var(--ui-primary) 10%, var(--surface)) 0%, var(--surface) 60%)",
                        }
                      : undefined
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {unread && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: "var(--ui-primary)" }}
                          aria-hidden
                        />
                      )}
                      {href ? (
                        <Link href={href} className="truncate font-semibold hover:underline">
                          {title}
                        </Link>
                      ) : (
                        <span className="truncate font-semibold">{title}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      <span className="pill">{kindLabel}</span>
                      {team && <span className="ml-2">{team.name}</span>}
                      <span className="ml-2 text-muted-2">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {unread && (
                    <form
                      action={async () => {
                        "use server";
                        await markOneRead(n.id);
                      }}
                    >
                      <button className="btn btn-ghost btn-sm">
                        {t("notifications.mark_read")}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card card-pad text-sm text-muted">
            {t("notifications.empty")}
          </p>
        )}
      </section>

      <section>
        <h2 className="section-title mb-3">
          {t("notifications.preferences")}
        </h2>
        <PreferencesForm
          rows={(prefs ?? []).map((p) => ({
            teamId: p.team_id,
            teamName: teamsById.get(p.team_id)?.name ?? "Unknown",
            email_new_challenge: p.email_new_challenge,
            email_leaderboard_passed: p.email_leaderboard_passed,
            email_approval_needed: p.email_approval_needed,
            in_app_new_challenge: p.in_app_new_challenge,
            in_app_leaderboard_passed: p.in_app_leaderboard_passed,
          }))}
          strings={{
            empty: t("notifications.prefs_empty"),
            save: t("notifications.save_prefs"),
            save_pending: t("notifications.save_prefs_pending"),
            saved: t("notifications.prefs_saved"),
            in_app_new_challenge: t("notifications.pref_in_app_new_challenge"),
            email_new_challenge: t("notifications.pref_email_new_challenge"),
            in_app_leaderboard_passed: t(
              "notifications.pref_in_app_leaderboard_passed",
            ),
            email_leaderboard_passed: t(
              "notifications.pref_email_leaderboard_passed",
            ),
            email_approval_needed: t("notifications.pref_email_approval_needed"),
          }}
        />
      </section>
    </main>
  );
}

function renderTitle(
  t: (key: string, vars?: Record<string, string | number>) => string,
  n: {
    kind: string;
    payload: Record<string, unknown>;
  },
): string {
  const key = `notifications.titles.${n.kind}`;
  switch (n.kind) {
    case "new_challenge":
      return t(key, { title: String(n.payload?.title ?? "(untitled)") });
    case "leaderboard_passed":
      return t(key, {
        name: String(n.payload?.leaderboard_name ?? ""),
      });
    case "approval_needed":
      return t(key);
    case "team_orphaned":
      return t(key, { name: String(n.payload?.team_name ?? "") });
    case "profile_change_reviewed":
      return t(key, { outcome: String(n.payload?.outcome ?? "") });
    default:
      return n.kind;
  }
}

function renderLink(
  n: { kind: string; payload: Record<string, unknown>; team_id: string | null },
  slug: string | null,
): string | null {
  if (!slug) return null;
  switch (n.kind) {
    case "new_challenge":
      return `/t/${slug}/challenges/${String(n.payload?.challenge_id ?? "")}`;
    case "approval_needed":
      return `/t/${slug}/admin/approvals`;
    case "team_orphaned":
      return `/admin`;
    default:
      return `/t/${slug}`;
  }
}
