import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";
import { setDefaultTeam } from "./actions";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slug, status, logo_path, header_image_path")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();
  const logoUrl = publicMediaUrl(team.logo_path);
  const headerUrl = publicMediaUrl(team.header_image_path);

  const [{ data: appUser }, { data: memberships }, unreadNotifs] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("is_super_admin, default_team_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("role, status, team_id, teams!inner(name, slug)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("deleted_at", null),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
  const unreadCount = unreadNotifs.count ?? 0;

  const isSuperAdmin = appUser?.is_super_admin ?? false;
  const membership = (memberships ?? []).find((m) => m.team_id === team.id);
  const isTeamAdmin =
    membership?.role === "team_admin" && membership?.status === "active";
  const otherTeams = (memberships ?? [])
    .filter((m) => m.team_id !== team.id)
    .map((m) => ({
      id: m.team_id,
      name: (m.teams as unknown as { name: string }).name,
      slug: (m.teams as unknown as { slug: string }).slug,
    }));
  const isDefault = appUser?.default_team_id === team.id;
  const t = await getT();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {headerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={headerUrl}
          alt=""
          className="mb-4 h-40 w-full rounded-md object-cover sm:h-48"
        />
      )}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-md border border-gray-200 object-cover"
            />
          )}
          <div>
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--theme-primary, inherit)" }}
          >
            {team.name}
          </h1>
          {team.status === "orphaned" && (
            <p className="mt-1 text-sm text-amber-600">{t("team.orphaned")}</p>
          )}
          {otherTeams.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span>{t("team.switch_to")}</span>
              {otherTeams.map((o) => (
                <Link
                  key={o.id}
                  href={`/t/${o.slug}`}
                  className="rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
                >
                  {o.name}
                </Link>
              ))}
              {!isDefault && membership && (
                <form
                  action={async () => {
                    "use server";
                    await setDefaultTeam(team.id);
                  }}
                >
                  <button className="rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-50">
                    {t("team.set_default")}
                  </button>
                </form>
              )}
              {isDefault && (
                <span className="text-gray-400">{t("team.default_tag")}</span>
              )}
            </div>
          )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/notifications"
            className="relative rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {t("nav.notifications")}
            {unreadCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Link>
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {t("nav.super_admin")}
            </Link>
          )}
          {(isTeamAdmin || isSuperAdmin) && (
            <Link
              href={`/t/${slug}/admin`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {t("nav.admin")}
            </Link>
          )}
        </div>
      </div>

      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/t/${slug}/challenges`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">{t("nav.challenges")}</div>
          <div className="mt-1 text-sm text-gray-500">
            {t("team.challenges_card")}
          </div>
        </Link>
        <Link
          href={`/t/${slug}/leaderboards`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">{t("nav.leaderboards")}</div>
          <div className="mt-1 text-sm text-gray-500">
            {t("team.leaderboards_card")}
          </div>
        </Link>
        <Link
          href={`/t/${slug}/members`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">{t("nav.roster")}</div>
          <div className="mt-1 text-sm text-gray-500">
            {t("team.roster_card")}
          </div>
        </Link>
        <Link
          href={`/t/${slug}/profile`}
          className="rounded-md border border-gray-200 p-4 hover:bg-gray-50"
        >
          <div className="font-semibold">{t("nav.profile")}</div>
          <div className="mt-1 text-sm text-gray-500">
            {t("team.profile_card")}
          </div>
        </Link>
      </nav>

      <form action="/logout" method="post" className="mt-10">
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          {t("common.sign_out")}
        </button>
      </form>
    </main>
  );
}
