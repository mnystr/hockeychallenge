import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";
import {
  Bell,
  Shield,
  ShieldStar,
  Target,
  Trophy,
  User,
  Users,
} from "@/components/icons";

type ActiveKey =
  | "challenges"
  | "leaderboards"
  | "members"
  | "profile"
  | null;

/**
 * Compact team header + nav shown at the top of every team-scoped page
 * except the team home (which has its own expanded version). Renders a
 * smaller version of the home hero (logo + name) and a single-row icon
 * nav for Challenges / Leaderboards / Members / Profile, with the
 * current tab visually distinguished.
 *
 * Server component — fetches the team, viewer role, and unread-count
 * itself so individual pages don't have to thread that data through.
 */
export default async function TeamShell({
  slug,
  active,
}: {
  slug: string;
  active: ActiveKey;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, status, logo_path")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) return null;

  const [{ data: appUser }, { data: membership }, unreadNotifs] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("is_super_admin")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("role, status")
        .eq("user_id", user.id)
        .eq("team_id", team.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
  const unreadCount = unreadNotifs.count ?? 0;
  const isSuperAdmin = appUser?.is_super_admin ?? false;
  const isTeamAdmin =
    membership?.role === "team_admin" && membership?.status === "active";
  const logoUrl = publicMediaUrl(team.logo_path);
  const t = await getT();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6">
      {/* Compact hero — half the height of the home page version */}
      <section className="team-shell-hero">
        <Link
          href={`/t/${slug}`}
          className="flex min-w-0 items-center gap-3 text-white no-underline"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-xl border border-white/30 bg-white/10 object-cover backdrop-blur"
            />
          ) : (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/30 bg-white/10 text-base font-extrabold text-white backdrop-blur">
              {team.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
              {team.name}
            </div>
            {team.status === "orphaned" && (
              <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-amber-200/60">
                {t("team.orphaned")}
              </p>
            )}
          </div>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Link
            href="/notifications"
            aria-label={t("nav.notifications")}
            className="team-shell-chip relative"
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
              aria-label={t("nav.super_admin")}
              className="team-shell-chip"
            >
              <ShieldStar className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.super_admin")}</span>
            </Link>
          )}
          {(isTeamAdmin || isSuperAdmin) && (
            <Link
              href={`/t/${slug}/admin`}
              aria-label={t("nav.admin")}
              className="team-shell-chip"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.admin")}</span>
            </Link>
          )}
        </div>
      </section>

      {/* Compact icon-row nav */}
      <nav className="team-shell-nav mt-3">
        <NavTab
          href={`/t/${slug}/challenges`}
          icon={<Target className="h-4 w-4" />}
          label={t("nav.challenges")}
          active={active === "challenges"}
        />
        <NavTab
          href={`/t/${slug}/leaderboards`}
          icon={<Trophy className="h-4 w-4" />}
          label={t("nav.leaderboards")}
          active={active === "leaderboards"}
        />
        <NavTab
          href={`/t/${slug}/members`}
          icon={<Users className="h-4 w-4" />}
          label={t("nav.roster")}
          active={active === "members"}
        />
        <NavTab
          href={`/t/${slug}/profile`}
          icon={<User className="h-4 w-4" />}
          label={t("nav.profile")}
          active={active === "profile"}
        />
      </nav>
    </div>
  );
}

function NavTab({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`team-shell-tab ${active ? "is-active" : ""}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
