"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function requestAccountDeletion(
  _state: { message?: string } | undefined,
  formData: FormData,
): Promise<{ message?: string } | undefined> {
  const confirmation = (formData.get("confirm") ?? "").toString().trim();
  const t = await getT();
  const expected = t("settings_data.delete_confirm_word");
  // Accept both the locale-appropriate word and "DELETE" for safety if
  // the user's locale cookie shifted between form render and submit.
  if (confirmation !== expected && confirmation !== "DELETE") {
    return { message: t("settings_data.delete_confirm_error") };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { message: error.message };

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
