"use client";

import { useActionState } from "react";
import { clearTeamMedia, uploadTeamMedia, type MediaFormState } from "./actions";

export type MediaUploadFormStrings = {
  no_image: string;
  uploading: string;
  upload: string;
  remove: string;
};

export default function MediaUploadForm({
  slug,
  kind,
  currentUrl,
  label,
  previewShape,
  strings,
}: {
  slug: string;
  kind: "logo" | "header";
  currentUrl: string | null;
  label: string;
  previewShape: "square" | "wide";
  strings: MediaUploadFormStrings;
}) {
  const bound = uploadTeamMedia.bind(null, slug, kind);
  const [state, action, pending] = useActionState<MediaFormState, FormData>(
    bound,
    undefined,
  );

  return (
    <div className="card card-pad">
      <h3 className="mb-2 font-semibold tracking-tight">{label}</h3>

      <div className="mb-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={label}
            className={
              previewShape === "square"
                ? "h-24 w-24 rounded-md border border-[color:var(--border)] object-cover"
                : "h-24 w-full rounded-md border border-[color:var(--border)] object-cover"
            }
          />
        ) : (
          <p className="text-sm text-muted">{strings.no_image}</p>
        )}
      </div>

      <form action={action} encType="multipart/form-data" className="space-y-2">
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-[color:var(--border)] file:bg-[color:var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-[color:var(--surface-2)]"
          required
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm"
          >
            {pending ? strings.uploading : strings.upload}
          </button>
          {currentUrl && (
            <form action={clearTeamMedia.bind(null, slug, kind)}>
              <button type="submit" className="btn btn-secondary btn-sm">
                {strings.remove}
              </button>
            </form>
          )}
        </div>
        {state?.error && (
          <p
            className="rounded-md px-3 py-1.5 text-sm"
            style={{
              background: "var(--danger-bg)",
              color: "var(--danger-fg)",
            }}
          >
            {state.error}
          </p>
        )}
        {state?.message && (
          <p
            className="rounded-md px-3 py-1.5 text-sm"
            style={{
              background: "var(--success-bg)",
              color: "var(--success-fg)",
            }}
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
