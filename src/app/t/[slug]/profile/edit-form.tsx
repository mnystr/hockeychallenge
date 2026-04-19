"use client";

import { useActionState } from "react";
import { submitProfileChange } from "./actions";
import type { ProfileChangeFormState } from "@/lib/auth/schemas-profile";

type Profile = {
  id: string;
  display_name: string;
  jersey_number: number | null;
  pronouns: string | null;
  visibility: "full" | "first_name_only" | "initials";
};

export default function ProfileEditForm({
  slug,
  profile,
}: {
  slug: string;
  profile: Profile;
}) {
  const bound = submitProfileChange.bind(null, slug, profile.id);
  const [state, action, pending] = useActionState<
    ProfileChangeFormState,
    FormData
  >(bound, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        name="display_name"
        label="Display name"
        defaultValue={profile.display_name}
        errors={state?.errors?.display_name}
        hint="How this player appears on rosters and leaderboards (subject to visibility setting)."
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          name="jersey_number"
          label="Jersey number"
          type="number"
          min={0}
          max={999}
          defaultValue={profile.jersey_number?.toString() ?? ""}
          errors={state?.errors?.jersey_number}
        />
        <Field
          name="pronouns"
          label="Pronouns"
          defaultValue={profile.pronouns ?? ""}
          errors={state?.errors?.pronouns}
        />
      </div>

      <div>
        <label htmlFor="visibility" className="mb-1 block text-sm font-medium">
          Visibility to teammates
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={profile.visibility}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="full">Full name (e.g. Alex Nystrom)</option>
          <option value="first_name_only">First name + initial (Alex N.)</option>
          <option value="initials">Initials only (A.N.)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Team admins always see the full display name.
        </p>
      </div>

      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.message.startsWith("Submitted")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit changes for approval"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  errors,
  hint,
  min,
  max,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  errors?: string[];
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {errors && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
