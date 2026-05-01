import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { themeTokensSchema } from "@/lib/themes/schema";
import { publicMediaUrl } from "@/lib/media/url";
import { setTeamTheme } from "./actions";
import MediaUploadForm from "./media-form";
import RenameForm from "./rename-form";

export default async function SettingsPage({
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
  const { data: team } = await supabase
    .from("teams")
    .select("name, theme_id, logo_path, header_image_path")
    .eq("id", ctx.teamId)
    .maybeSingle();

  const { data: themes } = await supabase
    .from("themes")
    .select("id, name, tokens")
    .order("name", { ascending: true });

  const { data: pendingRename } = await supabase
    .from("team_change_requests")
    .select("proposed_name, created_at")
    .eq("team_id", ctx.teamId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  const t = await getT();

  const mediaStrings = {
    no_image: t("admin.settings.media_no_image"),
    uploading: t("admin.settings.media_uploading"),
    upload: t("admin.settings.media_upload"),
    remove: t("admin.settings.media_remove"),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        {t("admin.settings.title")}
      </h1>

      <section className="mb-10">
        <h2 className="section-title mb-2">{t("admin.settings.rename_title")}</h2>
        <p className="mb-4 text-sm text-muted">
          {t("admin.settings.rename_body")}
        </p>
        <RenameForm
          slug={slug}
          currentName={team?.name ?? ""}
          pending={pendingRename ?? null}
          strings={{
            label: t("admin.settings.rename_label"),
            hint: t("admin.settings.rename_hint"),
            submit: t("admin.settings.rename_submit"),
            submitting: t("admin.settings.rename_submitting"),
            submitted_ok: t("admin.settings.rename_submitted_ok"),
            pending_banner: t("admin.settings.rename_pending_banner"),
            superseded_note: t("admin.settings.rename_superseded_note"),
          }}
        />
      </section>

      <section>
        <h2 className="section-title mb-2">{t("admin.settings.theme")}</h2>
        <p className="mb-4 text-sm text-muted">{t("admin.settings.theme_body")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(themes ?? []).map((th) => {
            const parsed = themeTokensSchema.safeParse(th.tokens);
            if (!parsed.success) return null;
            const tokens = parsed.data;
            const selected = team?.theme_id === th.id;
            return (
              <form
                key={th.id}
                action={async () => {
                  "use server";
                  await setTeamTheme(slug, th.id);
                }}
              >
                <button
                  type="submit"
                  className="card card-pad card-hover w-full text-left"
                  style={
                    selected
                      ? {
                          borderColor:
                            "color-mix(in oklab, var(--ui-primary) 50%, transparent)",
                          boxShadow:
                            "0 0 0 1px color-mix(in oklab, var(--ui-primary) 50%, transparent)",
                        }
                      : undefined
                  }
                >
                  <span className="font-semibold tracking-tight">
                    {th.name}
                    {selected && (
                      <>
                        {" "}
                        <span className="text-xs font-normal text-ui-primary">
                          {t("admin.settings.current")}
                        </span>
                      </>
                    )}
                  </span>
                  <div className="mt-2 flex gap-1">
                    {(
                      [
                        tokens.palette.primary,
                        tokens.palette.secondary,
                        tokens.palette.accent,
                        tokens.palette.bg,
                        tokens.palette.fg,
                      ] as const
                    ).map((c) => (
                      <span
                        key={c}
                        className="h-8 w-8 rounded-md border border-[color:var(--border)]"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="section-title mb-2">{t("admin.settings.team_images")}</h2>
        <p className="mb-4 text-sm text-muted">
          {t("admin.settings.team_images_body")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaUploadForm
            slug={slug}
            kind="logo"
            label="Logo"
            previewShape="square"
            currentUrl={publicMediaUrl(team?.logo_path)}
            strings={mediaStrings}
          />
          <MediaUploadForm
            slug={slug}
            kind="header"
            label="Header image"
            previewShape="wide"
            currentUrl={publicMediaUrl(team?.header_image_path)}
            strings={mediaStrings}
          />
        </div>
      </section>
    </main>
  );
}
