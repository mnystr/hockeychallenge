"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  const { data } = await supabase
    .from("app_users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!data?.is_super_admin) throw new Error("forbidden");
  return { supabase, userId: user.id };
}

export async function approveTeamRequest(requestId: string) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("approve_team_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function rejectTeamRequest(requestId: string, note: string | null) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("reject_team_request", {
    p_request_id: requestId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function promoteMemberToAdmin(membershipId: string) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("promote_member_to_admin", {
    p_membership_id: membershipId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
