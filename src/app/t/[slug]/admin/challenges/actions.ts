"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import {
  updateChallengeSchema,
  taskSchema,
  type UpdateChallengeFormState,
  type TaskFormState,
} from "@/lib/auth/schemas-challenges";
import { emailNewChallenge } from "@/lib/email/events";

export async function createChallengeDraft(slug: string) {
  const { teamId } = await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_challenge_draft", {
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  redirect(`/t/${slug}/admin/challenges/${data}`);
}

export async function updateChallenge(
  slug: string,
  challengeId: string,
  _state: UpdateChallengeFormState,
  formData: FormData,
): Promise<UpdateChallengeFormState> {
  await requireTeamAdmin(slug);
  // Conditionally-rendered fields come through as null; normalise so the
  // zod string schemas don't reject them silently.
  const s = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = updateChallengeSchema.safeParse({
    title: s("title"),
    description_md: s("description_md"),
    completion_points: s("completion_points"),
    completion_mode: s("completion_mode"),
    required_task_count: s("required_task_count"),
    publish_at: s("publish_at"),
    starts_at: s("starts_at"),
    ends_at: s("ends_at"),
    recurrence: s("recurrence"),
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
    .from("challenges")
    .update({
      title: parsed.data.title,
      description_md: parsed.data.description_md,
      completion_points: parsed.data.completion_points,
      completion_mode: parsed.data.completion_mode,
      required_task_count:
        parsed.data.completion_mode === "x_of_y"
          ? parsed.data.required_task_count
          : null,
      publish_at: parsed.data.publish_at,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      recurrence: parsed.data.recurrence,
      card_theme: parsed.data.card_theme,
    })
    .eq("id", challengeId);

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/admin/challenges/${challengeId}`);
  revalidatePath(`/t/${slug}/admin/challenges`);
  return { message: "Saved." };
}

async function setChallengeStatus(
  slug: string,
  challengeId: string,
  status: "draft" | "published" | "archived",
) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();

  // Capture the previous status so we know whether this is a
  // publish transition worth emailing about.
  const { data: before } = await supabase
    .from("challenges")
    .select("status, title")
    .eq("id", challengeId)
    .maybeSingle();

  const { error } = await supabase
    .from("challenges")
    .update({ status })
    .eq("id", challengeId);
  if (error) throw new Error(error.message);

  if (
    status === "published" &&
    before &&
    before.status !== "published"
  ) {
    // Fire-and-forget. DB trigger handles in-app notifications; this
    // adds the opted-in email. Failure inside emailNewChallenge is
    // already swallowed with a console.error.
    await emailNewChallenge({
      challengeId,
      teamSlug: slug,
      title: before.title,
    });
  }

  revalidatePath(`/t/${slug}/admin/challenges`);
  revalidatePath(`/t/${slug}/admin/challenges/${challengeId}`);
}

export async function publishChallenge(slug: string, id: string) {
  return setChallengeStatus(slug, id, "published");
}
export async function archiveChallenge(slug: string, id: string) {
  return setChallengeStatus(slug, id, "archived");
}
export async function unpublishChallenge(slug: string, id: string) {
  return setChallengeStatus(slug, id, "draft");
}

export async function softDeleteChallenge(slug: string, challengeId: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("challenges")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", challengeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/challenges`);
  redirect(`/t/${slug}/admin/challenges`);
}

// ---------- tasks ----------

export async function createTask(
  slug: string,
  challengeId: string,
  _state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  await requireTeamAdmin(slug);
  const s = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = taskSchema.safeParse({
    title: s("title"),
    description_md: s("description_md"),
    points: s("points"),
    target_count: s("target_count"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: maxPos } = await supabase
    .from("tasks")
    .select("position")
    .eq("challenge_id", challengeId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tasks").insert({
    challenge_id: challengeId,
    title: parsed.data.title,
    description_md: parsed.data.description_md,
    points: parsed.data.points,
    target_count: parsed.data.target_count,
    position: (maxPos?.position ?? -1) + 1,
  });

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/admin/challenges/${challengeId}`);
  return { message: "Task added." };
}

export async function updateTask(
  slug: string,
  challengeId: string,
  taskId: string,
  _state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  await requireTeamAdmin(slug);
  const s = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = taskSchema.safeParse({
    title: s("title"),
    description_md: s("description_md"),
    points: s("points"),
    target_count: s("target_count"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description_md: parsed.data.description_md,
      points: parsed.data.points,
      target_count: parsed.data.target_count,
    })
    .eq("id", taskId);

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/admin/challenges/${challengeId}`);
  return { message: "Saved." };
}

export async function deleteTask(
  slug: string,
  challengeId: string,
  taskId: string,
) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/challenges/${challengeId}`);
}
