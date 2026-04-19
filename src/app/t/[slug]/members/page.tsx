import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  renderDisplayName,
  type Visibility,
} from "@/lib/profiles/display-name";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";

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
      "user_id, display_name, jersey_number, pronouns, visibility, approved, profile_picture_path",
    )
    .eq("team_id", team.id)
    .is("deleted_at", null);

  const { data: roleRows } = await supabase
    .from("memberships")
    .select("user_id, role, status")
    .eq("team_id", team.id)
    .is("deleted_at", null);
  const roleByUser = new Map<string, { role: string; status: string }>();
  for (const r of roleRows ?? []) {
    roleByUser.set(r.user_id, { role: r.role, status: r.status });
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← {team.name}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">{t("roster.title")}</h1>

      {visible.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {visible.map((p) => {
            const isYou = p.user_id === user.id;
            const shown =
              isAdmin || isYou
                ? p.display_name
                : renderDisplayName(p.display_name, p.visibility as Visibility);
            const role = roleByUser.get(p.user_id)?.role;
            // Players with visibility=initials also hide their photo from
            // non-admin teammates. Admins and the owner always see it.
            const photoVisible =
              isAdmin || isYou || p.visibility !== "initials";
            const photoUrl = photoVisible
              ? publicMediaUrl(p.profile_picture_path)
              : null;
            return (
              <li
                key={p.user_id}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                  isYou ? "bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-400">
                    {shown.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-medium">
                    {shown}
                    {isYou && (
                      <span className="ml-1 text-gray-500">
                        {t("leaderboards.you")}
                      </span>
                    )}
                    {role === "team_admin" && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {t("roster.admin_badge")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {p.jersey_number !== null
                      ? `#${p.jersey_number}`
                      : t("roster.no_jersey")}
                    {p.pronouns ? ` · ${p.pronouns}` : ""}
                    {isAdmin && !p.approved && ` · ${t("roster.profile_pending")}`}
                  </div>
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{t("roster.empty")}</p>
      )}
    </main>
  );
}
