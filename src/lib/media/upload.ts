import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service";

export const BUCKET = "media";

export type UploadKind = "avatar" | "logo" | "header";

const DIMENSIONS: Record<UploadKind, { width: number; height: number | null }> = {
  avatar: { width: 512, height: 512 },
  logo: { width: 512, height: 512 },
  header: { width: 1600, height: 500 },
};

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export class UploadError extends Error {}

/**
 * Validate + resize + store an image. Returns the Storage path written.
 * `prefix` is the directory inside the bucket (e.g. `profiles/<user>`), and
 * a random filename is appended so stale paths don't collide.
 */
export async function uploadImage(
  file: File,
  kind: UploadKind,
  prefix: string,
): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("empty_file");
  if (file.size > MAX_INPUT_BYTES) throw new UploadError("file_too_large");
  if (!ALLOWED_MIME.has(file.type)) throw new UploadError("unsupported_type");

  const buf = Buffer.from(await file.arrayBuffer());
  const { width, height } = DIMENSIONS[kind];

  const resized = await sharp(buf, { failOn: "error" })
    .rotate()
    .resize({
      width,
      height: height ?? undefined,
      fit: height ? "cover" : "inside",
      withoutEnlargement: false,
    })
    .webp({ quality: 82 })
    .toBuffer();

  const filename = `${crypto.randomUUID()}.webp`;
  const path = `${prefix.replace(/^\/+|\/+$/g, "")}/${filename}`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, resized, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new UploadError(`storage_upload_failed: ${error.message}`);

  return path;
}

export async function deleteImage(path: string): Promise<void> {
  if (!path) return;
  const supabase = createServiceClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
