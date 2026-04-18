"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  standaloneEntrySchema,
  type StandaloneEntryFormState,
} from "@/lib/auth/schemas-leaderboards";

export async function submitStandaloneEntry(
  slug: string,
  leaderboardId: string,
  _state: StandaloneEntryFormState,
  formData: FormData,
): Promise<StandaloneEntryFormState> {
  const parsed = standaloneEntrySchema.safeParse({
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Not authenticated." };

  const { error } = await supabase
    .from("leaderboard_entries")
    .upsert(
      { leaderboard_id: leaderboardId, user_id: user.id, value: parsed.data.value },
      { onConflict: "leaderboard_id,user_id" },
    );

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/leaderboards/${leaderboardId}`);
  return { message: "Saved." };
}
