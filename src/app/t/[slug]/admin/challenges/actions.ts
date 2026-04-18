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
  const parsed = updateChallengeSchema.safeParse({
    title: formData.get("title"),
    description_md: formData.get("description_md") ?? "",
    completion_points: formData.get("completion_points"),
    completion_mode: formData.get("completion_mode"),
    required_task_count: formData.get("required_task_count"),
    publish_at: formData.get("publish_at"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    recurrence: formData.get("recurrence"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
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
  const { error } = await supabase
    .from("challenges")
    .update({ status })
    .eq("id", challengeId);
  if (error) throw new Error(error.message);
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
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description_md: formData.get("description_md") ?? "",
    points: formData.get("points"),
    target_count: formData.get("target_count"),
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
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description_md: formData.get("description_md") ?? "",
    points: formData.get("points"),
    target_count: formData.get("target_count"),
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
