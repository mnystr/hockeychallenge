import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { ChevronLeft } from "@/components/icons";
import DeleteAccountForm from "./delete-form";

export default async function DataSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ui-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("common.back_home")}
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        {t("settings_data.title")}
      </h1>

      <section className="card card-pad mb-8">
        <h2 className="mb-2 text-lg font-bold tracking-tight">
          {t("settings_data.download_title")}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {t("settings_data.download_body")}
        </p>
        <a
          href="/settings/data/export"
          className="btn btn-primary"
          download
        >
          {t("settings_data.download_cta")}
        </a>
      </section>

      <section
        className="card card-pad"
        style={{
          borderColor: "color-mix(in oklab, var(--danger) 35%, transparent)",
        }}
      >
        <h2
          className="mb-2 text-lg font-bold tracking-tight"
          style={{ color: "var(--danger-fg)" }}
        >
          {t("settings_data.delete_title")}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {t("settings_data.delete_body")}
        </p>
        <DeleteAccountForm
          strings={{
            confirm_label: t("settings_data.delete_confirm_label"),
            confirm_verify: t("settings_data.delete_confirm_verify"),
            confirm_word: t("settings_data.delete_confirm_word"),
            confirm_error: t("settings_data.delete_confirm_error"),
            cta: t("settings_data.delete_cta"),
            cta_pending: t("settings_data.delete_cta_pending"),
          }}
        />
      </section>
    </main>
  );
}
