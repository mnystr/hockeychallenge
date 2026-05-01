import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  renderDisplayName,
  type Visibility,
} from "@/lib/profiles/display-name";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";
import { Users } from "@/components/icons";
import TeamShell from "@/components/TeamShell";
import { demoteMember, removeMember } from "../admin/actions";

export default async function RosterPage({
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
    .select("role, status")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership || membership.status !== "active") {
    redirect(`/t/${slug}`);
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    appUser?.is_super_admin === true || membership.role === "team_admin";

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "user_id, display_name, jersey_number, visibility, approved, profile_picture_path",
    )
    .eq("team_id", team.id)
    .is("deleted_at", null);

  const { data: roleRows } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("team_id", team.id)
    .is("deleted_at", null);
  const roleByUser = new Map<
    string,
    { id: string; role: string; status: string }
  >();
  for (const r of roleRows ?? []) {
    roleByUser.set(r.user_id, { id: r.id, role: r.role, status: r.status });
  }

  const visible = (profiles ?? []).filter((p) => {
    const m = roleByUser.get(p.user_id);
    if (isAdmin) return m?.status === "active";
    return p.approved && m?.status === "active";
  });

  visible.sort((a, b) => {
    const aAdmin = roleByUser.get(a.user_id)?.role === "team_admin";
    const bAdmin = roleByUser.get(b.user_id)?.role === "team_admin";
    if (aAdmin !== bAdmin) return aAdmin ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  const t = await getT();

  return (
    <>
      <TeamShell slug={slug} active="members" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <header className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
                color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
              }}
            >
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t("roster.title")}
            </h1>
          </header>
          {isAdmin && (
            <a
              href={`/t/${slug}/admin/roster-export`}
              className="btn btn-secondary btn-sm"
            >
              {t("roster.export_csv")}
            </a>
          )}
        </div>

      {visible.length > 0 ? (
        <ul className="space-y-1.5">
          {visible.map((p) => {
            const isYou = p.user_id === user.id;
            const shown =
              isAdmin || isYou
                ? p.display_name
                : renderDisplayName(p.display_name, p.visibility as Visibility);
            const role = roleByUser.get(p.user_id)?.role;
            const photoVisible =
              isAdmin || isYou || p.visibility !== "initials";
            const photoUrl = photoVisible
              ? publicMediaUrl(p.profile_picture_path)
              : null;
            return (
              <li
                key={p.user_id}
                className="card flex items-center justify-between gap-3 px-3 py-2"
                style={
                  isYou
                    ? {
                        borderColor:
                          "color-mix(in oklab, var(--ui-primary) 45%, transparent)",
                        background:
                          "linear-gradient(90deg, color-mix(in oklab, var(--ui-primary) 10%, var(--surface)) 0%, var(--surface) 60%)",
                      }
                    : undefined
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt=""
                      className="avatar avatar-sm object-cover"
                    />
                  ) : (
                    <div className="avatar avatar-sm">
                      {shown.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {p.jersey_number !== null && (
                    <span className="mono w-8 shrink-0 text-right text-sm font-bold text-muted-2">
                      #{p.jersey_number}
                    </span>
                  )}
                  <span className="min-w-0 truncate font-semibold tracking-tight">
                    {shown}
                  </span>
                  {isYou && (
                    <span className="shrink-0 text-xs text-muted">
                      {t("leaderboards.you")}
                    </span>
                  )}
                  {role === "team_admin" && (
                    <span className="pill pill-primary shrink-0">
                      {t("roster.admin_badge")}
                    </span>
                  )}
                  {isAdmin && !p.approved && (
                    <span className="shrink-0 text-xs text-muted">
                      {t("roster.profile_pending")}
                    </span>
                  )}
                </div>
                {isAdmin && !isYou && (
                  <div className="flex shrink-0 gap-2">
                    {role === "team_admin" && (
                      <form
                        action={demoteMember.bind(
                          null,
                          slug,
                          roleByUser.get(p.user_id)!.id,
                        )}
                      >
                        <button type="submit" className="btn btn-secondary btn-sm">
                          {t("roster.demote")}
                        </button>
                      </form>
                    )}
                    <form
                      action={removeMember.bind(
                        null,
                        slug,
                        roleByUser.get(p.user_id)!.id,
                      )}
                    >
                      <button type="submit" className="btn btn-danger btn-sm">
                        {t("roster.remove")}
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        ) : (
          <p className="card card-pad text-sm text-muted">{t("roster.empty")}</p>
        )}
      </main>
    </>
  );
}
