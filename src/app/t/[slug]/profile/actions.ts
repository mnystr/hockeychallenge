"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import {
  profileChangeSchema,
  type ProfileChangeFormState,
} from "@/lib/auth/schemas-profile";

export async function submitProfileChange(
  slug: string,
  profileId: string,
  _state: ProfileChangeFormState,
  formData: FormData,
): Promise<ProfileChangeFormState> {
  const s = (k: string) => (formData.get(k) ?? "").toString();
  const parsed = profileChangeSchema.safeParse({
    display_name: s("display_name"),
    jersey_number: s("jersey_number"),
    pronouns: s("pronouns"),
    visibility: s("visibility"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      errors: fieldErrors,
      message:
        Object.values(fieldErrors).flat().find((v): v is string => Boolean(v)) ??
        "Please fix the errors and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_profile_change", {
    p_profile_id: profileId,
    p_display_name: parsed.data.display_name || null,
    p_jersey_number: parsed.data.jersey_number,
    p_pronouns: parsed.data.pronouns || null,
    p_visibility: parsed.data.visibility,
    p_picture_path: null,
  });

  if (error) return { message: error.message };

  revalidatePath(`/t/${slug}/profile`);
  const t = await getT();
  return { message: t("profile.submitted_ok") };
}
