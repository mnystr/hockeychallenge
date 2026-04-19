import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markOneRead } from "./actions";
import PreferencesForm from "./preferences-form";

const KIND_LABELS: Record<string, string> = {
  new_challenge: "New challenge",
  leaderboard_passed: "Leaderboard passed",
  approval_needed: "Approval needed",
  team_orphaned: "Team without admin",
  profile_change_reviewed: "Profile change reviewed",
};

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
    const t = m.teams as unknown as { id: string; name: string; slug: string };
    teamsById.set(t.id, { name: t.name, slug: t.slug });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Notifications</h1>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent</h2>
          {(notifications ?? []).some((n) => !n.read_at) && (
            <form
              action={async () => {
                "use server";
                await markAllRead();
              }}
            >
              <button className="text-sm text-blue-600 hover:underline">
                Mark all read
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
              return (
                <li
                  key={n.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${unread ? "bg-blue-50" : ""}`}
                >
                  <div className="flex-1">
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">
                        {renderTitle(n)}
                      </Link>
                    ) : (
                      <span className="font-medium">{renderTitle(n)}</span>
                    )}
                    <div className="mt-0.5 text-xs text-gray-500">
                      {KIND_LABELS[n.kind] ?? n.kind}
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
                        mark read
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No notifications yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Preferences</h2>
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
        />
      </section>
    </main>
  );
}

function renderTitle(n: {
  kind: string;
  payload: Record<string, unknown>;
}): string {
  switch (n.kind) {
    case "new_challenge":
      return `New challenge: ${String(n.payload?.title ?? "(untitled)")}`;
    case "leaderboard_passed":
      return `You were passed on ${String(n.payload?.leaderboard_name ?? "a leaderboard")}`;
    case "approval_needed":
      return "Something needs your approval";
    case "team_orphaned":
      return `Team needs an admin: ${String(n.payload?.team_name ?? "")}`;
    case "profile_change_reviewed":
      return `Profile change ${String(n.payload?.outcome ?? "reviewed")}`;
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
