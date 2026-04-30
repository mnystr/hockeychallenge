import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

export default async function Home() {
  const session = await getSessionState();

  if (session.kind === "has_memberships") {
    redirect(`/t/${session.defaultTeamSlug}`);
  }
  if (session.kind === "no_memberships") {
    if (session.hasPendingMembership || session.hasPendingTeamRequest) {
      redirect("/onboarding/pending");
    }
    redirect("/onboarding");
  }

  // Anonymous — show the landing presentation.
  const t = await getT();

  return (
    <main className="mx-auto flex min-h-[90vh] max-w-3xl flex-col justify-center px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        {t("landing.title")}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-gray-600">
        {t("landing.subtitle")}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <FeatureCard
          title={t("landing.features.challenges.title")}
          body={t("landing.features.challenges.body")}
        />
        <FeatureCard
          title={t("landing.features.leaderboards.title")}
          body={t("landing.features.leaderboards.body")}
        />
        <FeatureCard
          title={t("landing.features.safety.title")}
          body={t("landing.features.safety.body")}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("landing.cta_signin")}
        </Link>
        <Link
          href="/login?mode=signup"
          className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {t("landing.cta_signup")}
        </Link>
      </div>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{body}</div>
    </div>
  );
}
