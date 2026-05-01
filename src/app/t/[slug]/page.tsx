import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";
import { Bell, Shield, Target, Trophy, User, Users } from "@/components/icons";
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
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Hero */}
      <section className={`hero-panel${headerUrl ? " hero-panel--photo" : ""}`}>
        {headerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={headerUrl} alt="" className="hero-image" />
        )}
        <div
          className={
            headerUrl
              ? "absolute inset-x-1.5 top-1.5 z-[2] flex flex-wrap items-start justify-between gap-4 p-5"
              : "relative flex flex-wrap items-start justify-between gap-4"
          }
        >
          <div className="flex items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/30 bg-white/10 object-cover shadow-lg backdrop-blur"
              />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-white/30 bg-white/10 text-2xl font-extrabold text-white backdrop-blur">
                {team.name.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {team.name}
              </h1>
              {team.status === "orphaned" && (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-100 ring-1 ring-amber-200/60">
                  {t("team.orphaned")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/notifications"
              className="relative inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.notifications")}</span>
              {unreadCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-[color:var(--ui-primary)]">
                  {unreadCount}
                </span>
              )}
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                <Shield className="h-4 w-4" />
                {t("nav.super_admin")}
              </Link>
            )}
            {(isTeamAdmin || isSuperAdmin) && (
              <Link
                href={`/t/${slug}/admin`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                <Shield className="h-4 w-4" />
                {t("nav.admin")}
              </Link>
            )}
          </div>
        </div>
      </section>

      {otherTeams.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">{t("team.switch_to")}</span>
          {otherTeams.map((o) => (
            <Link
              key={o.id}
              href={`/t/${o.slug}`}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-0.5 font-medium text-app-fg shadow-sm transition hover:bg-[color:var(--surface-2)]"
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
              <button className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-0.5 font-medium text-app-fg shadow-sm transition hover:bg-[color:var(--surface-2)]">
                {t("team.set_default")}
              </button>
            </form>
          )}
          {isDefault && <span className="text-muted-2">{t("team.default_tag")}</span>}
        </div>
      )}

      <nav className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard
          href={`/t/${slug}/challenges`}
          icon={<Target className="h-6 w-6" />}
          title={t("nav.challenges")}
          body={t("team.challenges_card")}
        />
        <NavCard
          href={`/t/${slug}/leaderboards`}
          icon={<Trophy className="h-6 w-6" />}
          title={t("nav.leaderboards")}
          body={t("team.leaderboards_card")}
          tone="accent"
        />
        <NavCard
          href={`/t/${slug}/members`}
          icon={<Users className="h-6 w-6" />}
          title={t("nav.roster")}
          body={t("team.roster_card")}
        />
        <NavCard
          href={`/t/${slug}/profile`}
          icon={<User className="h-6 w-6" />}
          title={t("nav.profile")}
          body={t("team.profile_card")}
        />
      </nav>

      <div className="mt-10 flex items-center justify-between text-xs text-muted-2">
        <Link href="/settings/data" className="hover:underline">
          {t("settings_data.title")}
        </Link>
        <form action="/logout" method="post">
          <button type="submit" className="hover:underline">
            {t("common.sign_out")}
          </button>
        </form>
      </div>
    </main>
  );
}

function NavCard({
  href,
  icon,
  title,
  body,
  tone = "primary",
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "primary" | "accent";
}) {
  const iconBg =
    tone === "accent"
      ? "color-mix(in oklab, var(--ui-accent) 18%, var(--surface))"
      : "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))";
  const iconFg =
    tone === "accent"
      ? "color-mix(in oklab, var(--ui-accent) 70%, black)"
      : "color-mix(in oklab, var(--ui-primary) 75%, black)";
  return (
    <Link href={href} className="card card-pad card-hover card-link">
      <div className="flex items-center gap-3">
        <div
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </div>
        <div className="font-semibold tracking-tight">{title}</div>
      </div>
      <div className="mt-2 text-sm text-muted">{body}</div>
    </Link>
  );
}
