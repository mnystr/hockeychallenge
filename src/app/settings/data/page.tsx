import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import DeleteAccountForm from "./delete-form";

export default async function DataSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getT();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        {t("common.back_home")}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">{t("settings_data.title")}</h1>

      <section className="mb-10 rounded-md border border-gray-200 p-4">
        <h2 className="mb-2 text-lg font-semibold">
          {t("settings_data.download_title")}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {t("settings_data.download_body")}
        </p>
        <a
          href="/settings/data/export"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          download
        >
          {t("settings_data.download_cta")}
        </a>
      </section>

      <section className="rounded-md border border-red-200 p-4">
        <h2 className="mb-2 text-lg font-semibold text-red-800">
          {t("settings_data.delete_title")}
        </h2>
        <p className="mb-4 text-sm text-red-700">
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
