import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Plus } from "@/components/icons";
import { createLessonDraft } from "./actions";

export default async function LessonsAdminListPage({
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
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, status, read_points, publish_at, updated_at")
    .eq("team_id", ctx.teamId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  // Read stats: how many active members have read each lesson.
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const [activeMembers, { data: reads }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.teamId)
      .eq("status", "active")
      .is("deleted_at", null),
    lessonIds.length
      ? supabase
          .from("lesson_reads")
          .select("lesson_id")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as Array<{ lesson_id: string }> }),
  ]);
  const memberCount = activeMembers.count ?? 0;
  const readsByLesson = new Map<string, number>();
  for (const r of reads ?? []) {
    readsByLesson.set(r.lesson_id, (readsByLesson.get(r.lesson_id) ?? 0) + 1);
  }

  const t = await getT();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-3 inline-block text-sm font-medium text-ui-primary hover:underline"
      >
        {t("admin.back_admin")}
      </Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("admin.lessons.title")}
        </h1>
        <form
          action={async () => {
            "use server";
            await createLessonDraft(slug);
          }}
        >
          <button className="btn btn-primary">
            <Plus className="h-4 w-4" />
            {t("admin.lessons.new_lesson")}
          </button>
        </form>
      </div>

      {lessons && lessons.length > 0 ? (
        <ul className="space-y-2">
          {lessons.map((l) => (
            <li key={l.id}>
              <Link
                href={`/t/${slug}/admin/lessons/${l.id}`}
                className="card card-pad card-hover card-link flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold tracking-tight">
                    {l.title || t("admin.lessons.untitled")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t("admin.lessons.updated", {
                      date: new Date(l.updated_at).toLocaleString(),
                    })}
                    {l.read_points > 0 &&
                      ` · ${t("admin.lessons.read_points_short", {
                        points: l.read_points,
                      })}`}
                    {l.status === "published" &&
                      ` · ${t("admin.lessons.read_count", {
                        reads: readsByLesson.get(l.id) ?? 0,
                        members: memberCount,
                      })}`}
                  </div>
                </div>
                <StatusBadge status={l.status} t={t} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card card-pad text-sm text-muted">
          {t("admin.lessons.empty")}
        </p>
      )}
    </main>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const labelKey =
    status === "draft"
      ? "admin.lessons.status_draft"
      : status === "published"
        ? "admin.lessons.status_published"
        : "admin.lessons.status_archived";
  const cls =
    status === "published"
      ? "pill pill-success"
      : status === "archived"
        ? "pill pill-warning"
        : "pill";
  return <span className={cls}>{t(labelKey)}</span>;
}
