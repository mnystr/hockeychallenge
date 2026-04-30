"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import {
  leaderboardSchema,
  type LeaderboardFormState,
} from "@/lib/auth/schemas-leaderboards";

function parseForm(formData: FormData) {
  const s = (k: string) => (formData.get(k) ?? "").toString();
  return leaderboardSchema.safeParse({
    name: s("name"),
    description: s("description"),
    kind: s("kind"),
    sort_order: s("sort_order"),
    unit: s("unit"),
    starts_at: s("starts_at"),
    ends_at: s("ends_at"),
  });
}

export async function createLeaderboard(
  slug: string,
  _state: LeaderboardFormState,
  formData: FormData,
): Promise<LeaderboardFormState> {
  const { teamId } = await requireTeamAdmin(slug);
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leaderboards")
    .insert({ team_id: teamId, ...parsed.data })
    .select("id")
    .single();

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/admin/leaderboards`);
  redirect(`/t/${slug}/admin/leaderboards/${data.id}`);
}

export async function updateLeaderboard(
  slug: string,
  id: string,
  _state: LeaderboardFormState,
  formData: FormData,
): Promise<LeaderboardFormState> {
  await requireTeamAdmin(slug);
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leaderboards")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/admin/leaderboards/${id}`);
  revalidatePath(`/t/${slug}/admin/leaderboards`);
  return { message: "Saved." };
}

export async function archiveLeaderboardAction(slug: string, id: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_leaderboard", {
    p_leaderboard_id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/leaderboards`);
  revalidatePath(`/t/${slug}/admin/leaderboards/${id}`);
  revalidatePath(`/t/${slug}/leaderboards`);
  revalidatePath(`/t/${slug}/leaderboards/${id}`);
}

export async function softDeleteLeaderboard(slug: string, id: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("leaderboards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/leaderboards`);
  redirect(`/t/${slug}/admin/leaderboards`);
}
