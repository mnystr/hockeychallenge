"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { uploadImage, UploadError } from "@/lib/media/upload";
import { emailApprovalNeeded } from "@/lib/email/events";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Not authenticated" };

  const t = await getT();

  let picturePath: string | null = null;
  const pictureFile = formData.get("picture");
  if (pictureFile instanceof File && pictureFile.size > 0) {
    try {
      picturePath = await uploadImage(pictureFile, "avatar", `profiles/${user.id}`);
    } catch (err) {
      if (err instanceof UploadError) {
        if (err.message === "file_too_large") return { message: t("profile.picture_too_large") };
        if (err.message === "unsupported_type") return { message: t("profile.picture_unsupported") };
      }
      return { message: t("profile.picture_failed") };
    }
  }

  const { error } = await supabase.rpc("submit_profile_change", {
    p_profile_id: profileId,
    p_display_name: parsed.data.display_name || null,
    p_jersey_number: parsed.data.jersey_number,
    // Legacy column the schema still defines; we no longer collect it
    // but pass null explicitly so PostgREST resolves the overload.
    p_pronouns: null,
    p_visibility: parsed.data.visibility,
    p_picture_path: picturePath,
  });

  if (error) return { message: error.message };

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (team) {
    await emailApprovalNeeded({
      teamId: team.id,
      teamName: team.name,
      teamSlug: team.slug,
      kind: "profile_change",
    });
  }

  revalidatePath(`/t/${slug}/profile`);
  return { message: t("profile.submitted_ok") };
}
