"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setDefaultTeam(teamId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  // RLS on app_users restricts updates to own row + forbids changing
  // is_super_admin via the self-update policy.
  const { error } = await supabase
    .from("app_users")
    .update({ default_team_id: teamId })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
