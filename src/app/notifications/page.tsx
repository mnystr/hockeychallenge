import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        {t("common.back_home")}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">{t("notifications.title")}</h1>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("notifications.recent")}</h2>
          {(notifications ?? []).some((n) => !n.read_at) && (
            <form
              action={async () => {
                "use server";
                await markAllRead();
              }}
            >
              <button className="text-sm text-blue-600 hover:underline">
                {t("notifications.mark_all_read")}
              </button>
            </form>
          )}
        </div>
        {notifications && notifications.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {notifications.map((n) => {
              const team = n.team_id ? teamsById.get(n.team_id) : null;
              const href = renderLink(n, team?.slug ?? null);
              const unread = !n.read_at;
              const title = renderTitle(t, n);
              const kindLabel = t(`notifications.kinds.${n.kind}`);
              return (
                <li
                  key={n.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${unread ? "bg-blue-50" : ""}`}
                >
                  <div className="flex-1">
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">
                        {title}
                      </Link>
                    ) : (
                      <span className="font-medium">{title}</span>
                    )}
                    <div className="mt-0.5 text-xs text-gray-500">
                      {kindLabel}
                      {team ? ` · ${team.name}` : ""}
                      {" · "}
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {unread && (
                    <form
                      action={async () => {
                        "use server";
                        await markOneRead(n.id);
                      }}
                    >
                      <button className="text-xs text-blue-600 hover:underline">
                        {t("notifications.mark_read")}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t("notifications.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
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
