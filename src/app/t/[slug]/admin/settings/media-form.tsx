"use client";

import { useActionState } from "react";
import { clearTeamMedia, uploadTeamMedia, type MediaFormState } from "./actions";

export default function MediaUploadForm({
  slug,
  kind,
  currentUrl,
  label,
  previewShape,
}: {
  slug: string;
  kind: "logo" | "header";
  currentUrl: string | null;
  label: string;
  previewShape: "square" | "wide";
}) {
  const bound = uploadTeamMedia.bind(null, slug, kind);
  const [state, action, pending] = useActionState<MediaFormState, FormData>(
    bound,
    undefined,
  );

  return (
    <div className="rounded-md border border-gray-200 p-4">
      <h3 className="mb-2 font-medium">{label}</h3>

      <div className="mb-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={label}
            className={
              previewShape === "square"
                ? "h-24 w-24 rounded-md border border-gray-200 object-cover"
                : "h-24 w-full rounded-md border border-gray-200 object-cover"
            }
          />
        ) : (
          <p className="text-sm text-gray-500">No image uploaded yet.</p>
        )}
      </div>

      <form action={action} encType="multipart/form-data" className="space-y-2">
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-50"
          required
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Uploading..." : "Upload"}
          </button>
          {currentUrl && (
            <form action={clearTeamMedia.bind(null, slug, kind)}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Remove
              </button>
            </form>
          )}
        </div>
        {state?.error && (
          <p className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="rounded-md bg-green-50 px-3 py-1.5 text-sm text-green-700">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
