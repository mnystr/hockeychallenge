"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";

export async function setTeamTheme(slug: string, themeId: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();

  // Verify the theme exists. RLS already lets us read themes; this guards
  // against a malicious payload.
  const { data: theme } = await supabase
    .from("themes")
    .select("id")
    .eq("id", themeId)
    .maybeSingle();
  if (!theme) throw new Error("Theme not found");

  const { error } = await supabase
    .from("teams")
    .update({ theme_id: themeId })
    .eq("slug", slug);
  if (error) throw new Error(error.message);

  revalidatePath(`/t/${slug}`, "layout");
}
