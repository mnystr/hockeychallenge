"use client";

import { useActionState } from "react";
import { submitStandaloneEntry } from "../actions";
import type { StandaloneEntryFormState } from "@/lib/auth/schemas-leaderboards";

export default function StandaloneEntryForm({
  slug,
  leaderboardId,
  unit,
  currentValue,
  strings,
}: {
  slug: string;
  leaderboardId: string;
  unit: string | null;
  currentValue: number | null;
  strings: {
    value_label: string;
    submit: string;
    update: string;
    pending: string;
    saved: string;
  };
}) {
  const bound = submitStandaloneEntry.bind(null, slug, leaderboardId);
  const [state, action, pending] = useActionState<
    StandaloneEntryFormState,
    FormData
  >(bound, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2" noValidate>
      <div className="flex-1">
        <label htmlFor="value" className="mb-1 block text-xs font-medium text-gray-700">
          {strings.value_label}
          {unit ? ` (${unit})` : ""}
        </label>
        <input
          id="value"
          name="value"
          type="number"
          step="any"
          defaultValue={currentValue ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {state?.errors?.value && (
          <p className="mt-1 text-xs text-red-600">{state.errors.value[0]}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? strings.pending
          : currentValue === null
            ? strings.submit
            : strings.update}
      </button>
      {state?.message && (
        <p
          className={`w-full rounded-md px-3 py-2 text-xs ${
            state.message === "Saved." || state.message === strings.saved
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
