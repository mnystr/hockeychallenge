import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Trophy, Target, Shield, Sparkles } from "@/components/icons";

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

  const t = await getT();

  return (
    <main className="mx-auto flex min-h-[90vh] w-full max-w-5xl flex-col justify-center px-4 py-14">
      <section className="hero-panel">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="pill pill-accent" style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}>
              <Sparkles className="h-3.5 w-3.5" /> off-season · 2026
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {t("landing.title")}
            </h1>
            <p className="mt-4 text-base/relaxed text-white/85 sm:text-lg/relaxed">
              {t("landing.subtitle")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-lg" style={{ background: "#fff", color: "var(--ui-primary)" }}>
                {t("landing.cta_signin")}
              </Link>
              <Link
                href="/login?mode=signup"
                className="btn btn-lg"
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.55)",
                }}
              >
                {t("landing.cta_signup")}
              </Link>
            </div>
          </div>
          <DecorTrophy />
        </div>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<Target className="h-6 w-6" />}
          title={t("landing.features.challenges.title")}
          body={t("landing.features.challenges.body")}
          tone="primary"
        />
        <FeatureCard
          icon={<Trophy className="h-6 w-6" />}
          title={t("landing.features.leaderboards.title")}
          body={t("landing.features.leaderboards.body")}
          tone="accent"
        />
        <FeatureCard
          icon={<Shield className="h-6 w-6" />}
          title={t("landing.features.safety.title")}
          body={t("landing.features.safety.body")}
          tone="primary"
        />
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "primary" | "accent";
}) {
  const bg =
    tone === "primary"
      ? "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))"
      : "color-mix(in oklab, var(--ui-accent) 18%, var(--surface))";
  const fg =
    tone === "primary"
      ? "color-mix(in oklab, var(--ui-primary) 75%, black)"
      : "color-mix(in oklab, var(--ui-accent) 70%, black)";
  return (
    <div className="card card-pad card-hover">
      <div
        className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: bg, color: fg }}
      >
        {icon}
      </div>
      <div className="text-base font-semibold tracking-tight">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function DecorTrophy() {
  return (
    <div className="relative hidden h-44 w-44 shrink-0 sm:block">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.45), rgba(255,255,255,0) 60%)",
        }}
      />
      <Trophy
        className="absolute inset-0 m-auto h-28 w-28"
        style={{ color: "#ffd66b", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.25))" }}
      />
    </div>
  );
}
