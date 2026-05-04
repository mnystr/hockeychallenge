import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Sparkles } from "@/components/icons";

export default async function CheckEmailPage() {
  const t = await getT();

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="card card-pad-lg">
        <span
          className="pill pill-primary inline-flex items-center gap-1.5"
          style={{ fontWeight: 700 }}
        >
          <Sparkles className="h-3 w-3" /> hockeychallenge
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {t("auth.check_email_title")}
        </h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
          {t("auth.check_email_body")}
        </p>
        <p className="mb-6 text-xs leading-relaxed text-muted-2">
          {t("auth.check_email_hint")}
        </p>
        <Link href="/login" className="btn btn-secondary btn-lg w-full">
          {t("auth.check_email_back_to_signin")}
        </Link>
      </div>
    </main>
  );
}
