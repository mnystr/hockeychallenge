"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import {
  updateLessonSchema,
  lessonLinkSchema,
  type UpdateLessonFormState,
} from "@/lib/auth/schemas-lessons";
import { emailNewLesson } from "@/lib/email/events";

export async function createLessonDraft(slug: string) {
  const { teamId } = await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lesson_draft", {
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  redirect(`/t/${slug}/admin/lessons/${data}`);
}

export async function updateLesson(
  slug: string,
  lessonId: string,
  _state: UpdateLessonFormState,
  formData: FormData,
): Promise<UpdateLessonFormState> {
  await requireTeamAdmin(slug);
  const s = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = updateLessonSchema.safeParse({
    title: s("title"),
    body_md: s("body_md"),
    read_points: s("read_points"),
    publish_at: s("publish_at"),
    card_theme: s("card_theme"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstMessage =
      Object.values(fieldErrors).flat().find((v): v is string => Boolean(v)) ??
      "Please fix the errors and try again.";
    return { errors: fieldErrors, message: firstMessage };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: parsed.data.title,
      body_md: parsed.data.body_md,
      read_points: parsed.data.read_points,
      publish_at: parsed.data.publish_at,
      card_theme: parsed.data.card_theme,
    })
    .eq("id", lessonId);

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/admin/lessons/${lessonId}`);
  revalidatePath(`/t/${slug}/admin/lessons`);
  revalidatePath(`/t/${slug}/lessons/${lessonId}`);
  return { message: "Saved." };
}

async function setLessonStatus(
  slug: string,
  lessonId: string,
  status: "draft" | "published" | "archived",
) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();

  // Capture the previous status so we know whether this is a publish
  // transition worth emailing about (the DB trigger handles in-app).
  const { data: before } = await supabase
    .from("lessons")
    .select("status, title")
    .eq("id", lessonId)
    .maybeSingle();

  const { error } = await supabase
    .from("lessons")
    .update({ status })
    .eq("id", lessonId);
  if (error) throw new Error(error.message);

  if (status === "published" && before && before.status !== "published") {
    await emailNewLesson({
      lessonId,
      teamSlug: slug,
      title: before.title,
    });
  }

  revalidatePath(`/t/${slug}/admin/lessons`);
  revalidatePath(`/t/${slug}/admin/lessons/${lessonId}`);
  revalidatePath(`/t/${slug}/lessons`);
}

export async function publishLesson(slug: string, id: string) {
  return setLessonStatus(slug, id, "published");
}
export async function archiveLesson(slug: string, id: string) {
  return setLessonStatus(slug, id, "archived");
}
export async function unpublishLesson(slug: string, id: string) {
  return setLessonStatus(slug, id, "draft");
}

export async function softDeleteLesson(slug: string, lessonId: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/lessons`);
  redirect(`/t/${slug}/admin/lessons`);
}

// ---------- related-content links ----------

export async function addLessonLink(
  slug: string,
  lessonId: string,
  formData: FormData,
) {
  await requireTeamAdmin(slug);
  // One <select> holds both kinds, prefixed to disambiguate:
  //   "c:<id>" = challenge, "l:<id>" = leaderboard.
  const raw = (formData.get("target") ?? "").toString();
  const [kind, id] = raw.split(":");
  const parsed = lessonLinkSchema.safeParse({
    challenge_id: kind === "c" ? id : "",
    leaderboard_id: kind === "l" ? id : "",
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: maxPos } = await supabase
    .from("lesson_links")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("lesson_links").insert({
    lesson_id: lessonId,
    challenge_id: parsed.data.challenge_id,
    leaderboard_id: parsed.data.leaderboard_id,
    position: (maxPos?.position ?? -1) + 1,
  });
  // Unique indexes make double-adds a no-op failure; surfacing it in the
  // UI isn't worth a form state round-trip here.
  if (error && error.code !== "23505") throw new Error(error.message);

  revalidatePath(`/t/${slug}/admin/lessons/${lessonId}`);
  revalidatePath(`/t/${slug}/lessons/${lessonId}`);
}

export async function removeLessonLink(
  slug: string,
  lessonId: string,
  linkId: string,
) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_links")
    .delete()
    .eq("id", linkId)
    .eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/lessons/${lessonId}`);
  revalidatePath(`/t/${slug}/lessons/${lessonId}`);
}
