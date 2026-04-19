"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestAccountDeletion(
  _state: { message?: string } | undefined,
  formData: FormData,
): Promise<{ message?: string } | undefined> {
  const confirmation = (formData.get("confirm") ?? "").toString().trim();
  if (confirmation !== "DELETE") {
    return { message: 'Type "DELETE" to confirm.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { message: error.message };

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
