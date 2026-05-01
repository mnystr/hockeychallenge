"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import {
  deleteImage,
  uploadImage,
  UploadError,
  type UploadKind,
} from "@/lib/media/upload";
import { createServiceClient } from "@/lib/supabase/service";

export type TeamRenameFormState =
  | { error?: string; message?: string }
  | undefined;

export async function submitTeamRename(
  slug: string,
  _prev: TeamRenameFormState,
  formData: FormData,
): Promise<TeamRenameFormState> {
  const ctx = await requireTeamAdmin(slug);
  const proposed = (formData.get("proposed_name") ?? "").toString().trim();
  if (proposed.length < 2 || proposed.length > 80) {
    return { error: "Name must be 2–80 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_team_change", {
    p_team_id: ctx.teamId,
    p_proposed_name: proposed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/t/${slug}/admin/settings`);
  return { message: "Submitted." };
}

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

export type MediaFormState =
  | { error?: string; message?: string }
  | undefined;

const KIND_TO_COLUMN: Record<
  "logo" | "header",
  { column: "logo_path" | "header_image_path"; upload: UploadKind }
> = {
  logo: { column: "logo_path", upload: "logo" },
  header: { column: "header_image_path", upload: "header" },
};

export async function uploadTeamMedia(
  slug: string,
  kind: "logo" | "header",
  _prev: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const ctx = await requireTeamAdmin(slug);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }

  const { column, upload } = KIND_TO_COLUMN[kind];
  let path: string;
  try {
    path = await uploadImage(file, upload, `teams/${ctx.teamId}`);
  } catch (err) {
    if (err instanceof UploadError) {
      if (err.message === "file_too_large") return { error: "File too large (max 15 MB)." };
      if (err.message === "unsupported_type") return { error: "File format not supported." };
    }
    return { error: "Upload failed." };
  }

  // Fetch prior path so we can delete the old file once the new one is saved.
  const admin = createServiceClient();
  const { data: prior } = await admin
    .from("teams")
    .select(column)
    .eq("id", ctx.teamId)
    .maybeSingle<{ logo_path?: string | null; header_image_path?: string | null }>();
  const priorPath = (prior?.[column] as string | null) ?? null;

  const { error } = await admin
    .from("teams")
    .update({ [column]: path })
    .eq("id", ctx.teamId);
  if (error) {
    await deleteImage(path);
    return { error: error.message };
  }

  if (priorPath) await deleteImage(priorPath);
  revalidatePath(`/t/${slug}`, "layout");
  return { message: "Saved." };
}

export async function clearTeamMedia(
  slug: string,
  kind: "logo" | "header",
) {
  const ctx = await requireTeamAdmin(slug);
  const { column } = KIND_TO_COLUMN[kind];
  const admin = createServiceClient();

  const { data: prior } = await admin
    .from("teams")
    .select(column)
    .eq("id", ctx.teamId)
    .maybeSingle<{ logo_path?: string | null; header_image_path?: string | null }>();
  const priorPath = (prior?.[column] as string | null) ?? null;

  await admin.from("teams").update({ [column]: null }).eq("id", ctx.teamId);
  if (priorPath) await deleteImage(priorPath);
  revalidatePath(`/t/${slug}`, "layout");
}
