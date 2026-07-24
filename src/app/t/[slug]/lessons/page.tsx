import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { BookOpen, Check, Star } from "@/components/icons";
import { isChallengeCardTheme } from "@/lib/challenges/card-themes";
import TeamShell from "@/components/TeamShell";

export default async function LessonsListPage({
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

  // RLS keeps drafts and unpublished lessons out for players; team-admins
  // also see published ones here (drafts live in the admin list).
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, read_points, card_theme, status, publish_at, updated_at")
    .eq("team_id", team.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("publish_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const lessonRows = lessons ?? [];
  const lessonIds = lessonRows.map((l) => l.id);
  const { data: reads } = lessonIds.length
    ? await supabase
        .from("lesson_reads")
        .select("lesson_id")
        .eq("user_id", user.id)
        .in("lesson_id", lessonIds)
    : { data: [] };
  const readIds = new Set((reads ?? []).map((r) => r.lesson_id));

  const t = await getT();

  return (
    <>
      <TeamShell slug={slug} active="lessons" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background:
                "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
              color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
            }}
          >
            <BookOpen className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("lessons.list_title")}
          </h1>
        </header>

        {lessonRows.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {lessonRows.map((l) => {
              const isRead = readIds.has(l.id);
              const themeAttr = isChallengeCardTheme(l.card_theme)
                ? l.card_theme
                : undefined;
              return (
                <li key={l.id}>
                  <Link
                    href={`/t/${slug}/lessons/${l.id}`}
                    className="challenge-card"
                    data-theme={themeAttr}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                        {l.title}
                      </h2>
                      {isRead && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
                          style={{ color: "var(--success-fg)" }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {t("lessons.read_badge")}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs/relaxed text-white/85 sm:text-sm/relaxed">
                      {l.publish_at && (
                        <span>
                          {new Date(l.publish_at).toLocaleDateString()}
                        </span>
                      )}
                      {l.read_points > 0 && !isRead && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-semibold uppercase tracking-wider ring-1 ring-white/30">
                          <Star className="h-3.5 w-3.5" />
                          {t("lessons.points_pill", { points: l.read_points })}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card card-pad text-sm text-muted">
            {t("lessons.empty")}
          </p>
        )}
      </main>
    </>
  );
}
