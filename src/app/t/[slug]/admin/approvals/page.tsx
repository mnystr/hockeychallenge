import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { publicMediaUrl } from "@/lib/media/url";
import { getT } from "@/lib/i18n/server";
import {
  approveMembership,
  rejectMembership,
  approveProfileChange,
  rejectProfileChange,
} from "../actions";

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let ctx;
  try {
    ctx = await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unauthorized") redirect("/login");
    if (msg === "team not found") notFound();
    redirect(`/t/${slug}`);
  }

  const supabase = await createClient();

  const { data: pendingMemberships } = await supabase
    .from("memberships")
    .select("id, user_id, created_at")
    .eq("team_id", ctx.teamId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const userIds = (pendingMemberships ?? []).map((m) => m.user_id);
  const profilesByUser = new Map<
    string,
    { display_name: string; jersey_number: number | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, jersey_number")
      .eq("team_id", ctx.teamId)
      .in("user_id", userIds)
      .is("deleted_at", null);
    for (const p of profiles ?? []) {
      profilesByUser.set(p.user_id, {
        display_name: p.display_name,
        jersey_number: p.jersey_number,
      });
    }
  }

  const { data: pendingChanges } = await supabase
    .from("profile_change_requests")
    .select(
      "id, profile_id, user_id, created_at, proposed_display_name, proposed_jersey_number, proposed_visibility, proposed_picture_path",
    )
    .eq("team_id", ctx.teamId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const changeProfileIds = (pendingChanges ?? []).map((c) => c.profile_id);
  const currentProfilesById = new Map<
    string,
    {
      display_name: string;
      jersey_number: number | null;
      visibility: string;
      profile_picture_path: string | null;
    }
  >();
  if (changeProfileIds.length > 0) {
    const { data: currentProfiles } = await supabase
      .from("profiles")
      .select(
        "id, display_name, jersey_number, visibility, profile_picture_path",
      )
      .in("id", changeProfileIds);
    for (const p of currentProfiles ?? []) {
      currentProfilesById.set(p.id, {
        display_name: p.display_name,
        jersey_number: p.jersey_number,
        visibility: p.visibility,
        profile_picture_path: p.profile_picture_path,
      });
    }
  }

  const hasAnything =
    (pendingMemberships && pendingMemberships.length > 0) ||
    (pendingChanges && pendingChanges.length > 0);

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        {t("admin.approvals.title")}
      </h1>

      {pendingMemberships && pendingMemberships.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-3">
            {t("admin.approvals.new_members")}
          </h2>
          <ul className="space-y-3">
            {pendingMemberships.map((m) => {
              const profile = profilesByUser.get(m.user_id) ?? null;
              return (
                <li
                  key={m.id}
                  className="card card-pad flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold tracking-tight">
                      {profile?.display_name ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {profile?.jersey_number !== null &&
                      profile?.jersey_number !== undefined
                        ? `#${profile.jersey_number}`
                        : t("admin.approvals.no_jersey")}
                      {" · "}
                      {t("admin.approvals.applied", {
                        date: new Date(m.created_at).toLocaleString(),
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await approveMembership(slug, m.id);
                      }}
                    >
                      <button className="btn btn-primary btn-sm">
                        {t("admin.approvals.approve")}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rejectMembership(slug, m.id, null);
                      }}
                    >
                      <button className="btn btn-secondary btn-sm">
                        {t("admin.approvals.reject")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pendingChanges && pendingChanges.length > 0 && (
        <section>
          <h2 className="section-title mb-3">
            {t("admin.approvals.profile_changes")}
          </h2>
          <ul className="space-y-3">
            {pendingChanges.map((c) => {
              const current = currentProfilesById.get(c.profile_id);
              return (
                <li
                  key={c.id}
                  className="card card-pad flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="font-semibold tracking-tight">
                      {current?.display_name ?? "—"}
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {c.proposed_display_name &&
                        c.proposed_display_name !== current?.display_name && (
                          <li>
                            {t("admin.approvals.diff_name")}{" "}
                            <span className="line-through">
                              {current?.display_name}
                            </span>{" "}
                            →{" "}
                            <span className="font-medium text-app-fg">
                              {c.proposed_display_name}
                            </span>
                          </li>
                        )}
                      {c.proposed_jersey_number !== null &&
                        c.proposed_jersey_number !== current?.jersey_number && (
                          <li>
                            {t("admin.approvals.diff_jersey")}{" "}
                            <span className="line-through">
                              {current?.jersey_number ?? "—"}
                            </span>{" "}
                            →{" "}
                            <span className="font-medium text-app-fg">
                              #{c.proposed_jersey_number}
                            </span>
                          </li>
                        )}
                      {c.proposed_visibility &&
                        c.proposed_visibility !== current?.visibility && (
                          <li>
                            {t("admin.approvals.diff_visibility")}{" "}
                            <span className="line-through">
                              {current?.visibility}
                            </span>{" "}
                            →{" "}
                            <span className="font-medium text-app-fg">
                              {c.proposed_visibility}
                            </span>
                          </li>
                        )}
                      {c.proposed_picture_path && (
                        <li className="mt-2 flex items-center gap-3">
                          <span>{t("admin.approvals.diff_picture")}</span>
                          {current?.profile_picture_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                publicMediaUrl(current.profile_picture_path) ??
                                ""
                              }
                              alt="current"
                              className="h-12 w-12 rounded-full object-cover opacity-50"
                            />
                          ) : (
                            <span className="text-muted-2">—</span>
                          )}
                          <span>→</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={publicMediaUrl(c.proposed_picture_path) ?? ""}
                            alt="proposed"
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        </li>
                      )}
                    </ul>
                    <div className="mt-2 text-xs text-muted-2">
                      {t("admin.approvals.submitted", {
                        date: new Date(c.created_at).toLocaleString(),
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await approveProfileChange(slug, c.id);
                      }}
                    >
                      <button className="btn btn-primary btn-sm">
                        {t("admin.approvals.approve")}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rejectProfileChange(slug, c.id, null);
                      }}
                    >
                      <button className="btn btn-secondary btn-sm">
                        {t("admin.approvals.reject")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!hasAnything && (
        <p className="card card-pad text-sm text-muted">
          {t("admin.approvals.nothing_pending")}
        </p>
      )}
    </main>
  );
}
