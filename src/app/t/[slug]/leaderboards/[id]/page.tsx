import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  renderDisplayName,
  type Visibility,
} from "@/lib/profiles/display-name";
import StandaloneEntryForm from "./entry-form";

type Row = {
  user_id: string;
  display_name: string;
  value: number;
  rank: number;
  display_order: number;
};

export default async function LeaderboardDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();

  const { data: board } = await supabase
    .from("leaderboards")
    .select(
      "id, name, description, kind, sort_order, unit, starts_at, ends_at, status, archived_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!board) notFound();

  // Team-admin / super-admin check for visibility of 0-value entries.
  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  const isAdmin =
    appUser?.is_super_admin === true ||
    (membership?.role === "team_admin" && membership?.status === "active");

  // Standings: view for active, snapshots for archived.
  let rows: Row[] = [];
  let ownRow: Row | null = null;

  if (board.status === "archived") {
    const { data: snapshots } = await supabase
      .from("leaderboard_snapshots")
      .select("user_id, display_name, value, rank")
      .eq("leaderboard_id", id)
      .order("rank", { ascending: true })
      .order("display_name", { ascending: true });
    rows = (snapshots ?? []).map((s, i) => ({
      ...s,
      value: Number(s.value),
      display_order: i + 1,
    }));
    ownRow = rows.find((r) => r.user_id === user.id) ?? null;
  } else {
    const { data: standings } = await supabase
      .from("leaderboard_active_standings")
      .select("user_id, display_name, value, rank, display_order")
      .eq("leaderboard_id", id)
      .order("display_order", { ascending: true });
    const all = (standings ?? []).map((r) => ({
      ...r,
      value: Number(r.value),
    })) as Row[];
    ownRow = all.find((r) => r.user_id === user.id) ?? null;
    // Visibility: hide 0-value entries from non-admins (except own row).
    rows = isAdmin
      ? all
      : all.filter((r) => r.value > 0 || r.user_id === user.id);
  }

  // Fetch current visibility per row's user so we can render names
  // correctly for non-admin viewers. Admins and own rows bypass.
  const rowUserIds = rows.map((r) => r.user_id);
  const visibilityByUser = new Map<string, Visibility>();
  if (rowUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, visibility")
      .eq("team_id", team.id)
      .in("user_id", rowUserIds)
      .eq("approved", true)
      .is("deleted_at", null);
    for (const p of profiles ?? []) {
      visibilityByUser.set(p.user_id, p.visibility as Visibility);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}/leaderboards`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Leaderboards
      </Link>
      <h1 className="text-3xl font-bold">{board.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {board.kind === "points" ? "Points" : "Standalone"}
        {board.unit ? ` · ${board.unit}` : ""}
        {board.status === "archived"
          ? ` · archived ${board.archived_at ? new Date(board.archived_at).toLocaleDateString() : ""}`
          : ""}
      </p>
      {board.description && (
        <p className="mt-3 text-sm text-gray-700">{board.description}</p>
      )}

      {board.kind === "standalone" && board.status === "active" && (
        <section className="mt-6 rounded-md border border-gray-200 p-4">
          <h2 className="mb-2 text-sm font-semibold">Your entry</h2>
          <StandaloneEntryForm
            slug={slug}
            leaderboardId={id}
            unit={board.unit}
            currentValue={ownRow?.value ?? null}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Standings</h2>
        {rows.length > 0 ? (
          <ol className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {rows.map((r) => {
              const isYou = r.user_id === user.id;
              // Admins and the row's owner see the raw display_name.
              // Everyone else sees the visibility-rendered version.
              const shownName =
                isAdmin || isYou
                  ? r.display_name
                  : renderDisplayName(
                      r.display_name,
                      visibilityByUser.get(r.user_id) ?? "full",
                    );
              return (
                <li
                  key={r.user_id}
                  className={`flex items-center justify-between px-4 py-2 ${
                    isYou ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-right font-mono text-sm text-gray-500">
                      {r.rank}
                    </span>
                    <span className="font-medium">
                      {shownName}
                      {isYou ? " (you)" : ""}
                    </span>
                  </div>
                  <span className="font-mono text-sm">
                    {r.value}
                    {board.unit ? ` ${board.unit}` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-gray-500">
            No one on the board yet{board.kind === "points" ? " — earn points by completing challenges." : " — be the first to enter a value."}
          </p>
        )}
      </section>
    </main>
  );
}
