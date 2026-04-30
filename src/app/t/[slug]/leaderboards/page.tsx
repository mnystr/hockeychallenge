import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export default async function LeaderboardsListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { data: membership } = await supabase
    .from("memberships")
    .select("status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership || membership.status !== "active") {
    redirect(`/t/${slug}`);
  }

  const { data: boards } = await supabase
    .from("leaderboards")
    .select("id, name, kind, status, unit, starts_at, ends_at")
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const active = (boards ?? []).filter((b) => b.status === "active");
  const archived = (boards ?? []).filter((b) => b.status === "archived");

  const t = await getT();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← {team.name}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">{t("leaderboards.list_title")}</h1>

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">
            {t("leaderboards.active")}
          </h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {active.map((b) => (
              <BoardRow key={b.id} slug={slug} board={b} t={t} />
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            {t("leaderboards.history")}
          </h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {archived.map((b) => (
              <BoardRow key={b.id} slug={slug} board={b} t={t} />
            ))}
          </ul>
        </section>
      )}

      {active.length === 0 && archived.length === 0 && (
        <p className="text-sm text-gray-500">{t("leaderboards.empty")}</p>
      )}
    </main>
  );
}

function BoardRow({
  slug,
  board,
  t,
}: {
  slug: string;
  board: {
    id: string;
    name: string;
    kind: string;
    status: string;
    unit: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <li>
      <Link
        href={`/t/${slug}/leaderboards/${board.id}`}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div>
          <div className="font-medium">{board.name}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {board.kind === "points"
              ? t("leaderboards.kind_points")
              : t("leaderboards.kind_standalone")}
            {board.unit ? ` · ${board.unit}` : ""}
            {board.ends_at
              ? ` · ${
                  board.status === "archived"
                    ? t("leaderboards.ended")
                    : t("leaderboards.ends")
                } ${new Date(board.ends_at).toLocaleDateString()}`
              : ""}
          </div>
        </div>
      </Link>
    </li>
  );
}
