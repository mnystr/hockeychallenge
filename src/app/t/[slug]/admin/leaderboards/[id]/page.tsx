import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import LeaderboardForm from "../form";
import {
  archiveLeaderboardAction,
  softDeleteLeaderboard,
} from "../actions";

export default async function EditLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  try {
    await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unauthorized") redirect("/login");
    if (msg === "team not found") notFound();
    redirect(`/t/${slug}`);
  }

  const supabase = await createClient();
  const { data: leaderboard } = await supabase
    .from("leaderboards")
    .select(
      "id, name, description, kind, sort_order, unit, starts_at, ends_at, status, card_theme",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!leaderboard) notFound();

  const t = await getT();

  const formStrings = {
    form_name: t("admin.leaderboards.form_name"),
    form_description: t("admin.leaderboards.form_description"),
    form_kind: t("admin.leaderboards.form_kind"),
    form_kind_points: t("admin.leaderboards.form_kind_points"),
    form_kind_standalone: t("admin.leaderboards.form_kind_standalone"),
    form_kind_locked: t("admin.leaderboards.form_kind_locked"),
    form_sort: t("admin.leaderboards.form_sort"),
    form_sort_higher: t("admin.leaderboards.form_sort_higher"),
    form_sort_lower: t("admin.leaderboards.form_sort_lower"),
    form_unit_optional: t("admin.leaderboards.form_unit_optional"),
    form_unit_ph: t("admin.leaderboards.form_unit_ph"),
    form_starts_at_optional: t("admin.leaderboards.form_starts_at_optional"),
    form_ends_at_optional: t("admin.leaderboards.form_ends_at_optional"),
    form_window_hint: t("admin.leaderboards.form_window_hint"),
    form_saving: t("admin.leaderboards.form_saving"),
    form_save: t("admin.leaderboards.form_save"),
    form_create: t("admin.leaderboards.form_create"),
    form_saved: t("admin.leaderboards.form_saved"),
    card_theme_label: t("admin.leaderboards.card_theme_label"),
    card_theme_hint: t("admin.leaderboards.card_theme_hint"),
    card_theme_default: t("admin.leaderboards.card_theme_default"),
    card_theme_aurora: t("admin.leaderboards.card_theme_aurora"),
    card_theme_inferno: t("admin.leaderboards.card_theme_inferno"),
    card_theme_glacier: t("admin.leaderboards.card_theme_glacier"),
    card_theme_forest: t("admin.leaderboards.card_theme_forest"),
    card_theme_sunset: t("admin.leaderboards.card_theme_sunset"),
    card_theme_lightning: t("admin.leaderboards.card_theme_lightning"),
    card_theme_royal: t("admin.leaderboards.card_theme_royal"),
    card_theme_ocean: t("admin.leaderboards.card_theme_ocean"),
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin/leaderboards`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.leaderboards.back")}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("admin.leaderboards.edit_title")}
        </h1>
        <div className="flex flex-wrap gap-2">
          {leaderboard.status === "active" && (
            <form
              action={async () => {
                "use server";
                await archiveLeaderboardAction(slug, id);
              }}
            >
              <button className="btn btn-secondary btn-sm">
                {t("admin.leaderboards.archive")}
              </button>
            </form>
          )}
          {leaderboard.status === "archived" && (
            <span className="pill pill-warning">
              {t("admin.leaderboards.archived")}
            </span>
          )}
          <form
            action={async () => {
              "use server";
              await softDeleteLeaderboard(slug, id);
            }}
          >
            <button className="btn btn-danger btn-sm">
              {t("admin.leaderboards.delete")}
            </button>
          </form>
        </div>
      </div>

      <LeaderboardForm
        slug={slug}
        leaderboard={leaderboard}
        strings={formStrings}
      />
    </main>
  );
}
