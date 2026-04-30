"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";

export async function restoreChallenge(slug: string, id: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("challenges")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/trash`);
  revalidatePath(`/t/${slug}/admin/challenges`);
}

export async function restoreLeaderboard(slug: string, id: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("leaderboards")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/trash`);
  revalidatePath(`/t/${slug}/admin/leaderboards`);
}
