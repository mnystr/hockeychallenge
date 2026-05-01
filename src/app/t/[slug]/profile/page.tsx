import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { publicMediaUrl } from "@/lib/media/url";
import { renderDisplayName } from "@/lib/profiles/display-name";
import { User } from "@/components/icons";
import TeamShell from "@/components/TeamShell";
import ProfileEditForm from "./edit-form";

export default async function ProfilePage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, jersey_number, visibility, approved, profile_picture_path",
    )
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) redirect(`/t/${slug}`);

  const { data: pending } = await supabase
    .from("profile_change_requests")
    .select(
      "id, proposed_display_name, proposed_jersey_number, proposed_visibility, proposed_picture_path, created_at",
    )
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  const t = await getT();

  return (
    <>
      <TeamShell slug={slug} active="profile" />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background:
                "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
              color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
            }}
          >
            <User className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("profile.title")}
          </h1>
        </header>

      {pending && (
        <section
          className="mb-6 card card-pad text-sm"
          style={{
            background: "var(--warning-bg)",
            borderColor:
              "color-mix(in oklab, var(--warning) 35%, transparent)",
            color: "var(--warning-fg)",
          }}
        >
          <p className="font-semibold">
            {t("profile.pending_banner_title")}
          </p>
          <p className="mt-1">
            {t("profile.pending_submitted", {
              time: new Date(pending.created_at).toLocaleString(),
            })}
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {pending.proposed_display_name && (
              <li>
                {t("profile.pending_name", {
                  name: pending.proposed_display_name,
                })}
              </li>
            )}
            {pending.proposed_jersey_number !== null && (
              <li>
                {t("profile.pending_jersey", {
                  number: pending.proposed_jersey_number,
                })}
              </li>
            )}
            {pending.proposed_visibility && (
              <li>
                {t("profile.pending_visibility", {
                  visibility: pending.proposed_visibility.replace("_", " "),
                })}
              </li>
            )}
            {pending.proposed_picture_path && (
              <li>{t("profile.pending_picture")}</li>
            )}
          </ul>
        </section>
      )}

      <ProfileEditForm
        slug={slug}
        profile={{
          id: profile.id,
          display_name: profile.display_name,
          jersey_number: profile.jersey_number,
          visibility: profile.visibility,
          picture_url: publicMediaUrl(profile.profile_picture_path),
        }}
        strings={{
          display_name_label: t("profile.display_name_label"),
          display_name_hint: t("profile.display_name_hint"),
          jersey_label: t("profile.jersey_label"),
          visibility_label: t("profile.visibility_label"),
          visibility_full: t("profile.visibility_full", {
            name: renderDisplayName(profile.display_name, "full"),
          }),
          visibility_first: t("profile.visibility_first", {
            name: renderDisplayName(profile.display_name, "first_name_only"),
          }),
          visibility_initials: t("profile.visibility_initials", {
            name: renderDisplayName(profile.display_name, "initials"),
          }),
          visibility_hint: t("profile.visibility_hint"),
          picture_label: t("profile.picture_label"),
          picture_hint: t("profile.picture_hint"),
          picture_current: t("profile.picture_current"),
          picture_none: t("profile.picture_none"),
          submit: t("profile.submit"),
          submit_pending: t("profile.submit_pending"),
          submitted_ok: t("profile.submitted_ok"),
        }}
      />
      </main>
    </>
  );
}
