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

type Strings = {
  display_name_label: string;
  display_name_hint: string;
  jersey_label: string;
  pronouns_label: string;
  visibility_label: string;
  visibility_full: string;
  visibility_first: string;
  visibility_initials: string;
  visibility_hint: string;
  submit: string;
  submit_pending: string;
  submitted_ok: string;
};

export default function ProfileEditForm({
  slug,
  profile,
  strings,
}: {
  slug: string;
  profile: Profile;
  strings: Strings;
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
        label={strings.display_name_label}
        defaultValue={profile.display_name}
        errors={state?.errors?.display_name}
        hint={strings.display_name_hint}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          name="jersey_number"
          label={strings.jersey_label}
          type="number"
          min={0}
          max={999}
          defaultValue={profile.jersey_number?.toString() ?? ""}
          errors={state?.errors?.jersey_number}
        />
        <Field
          name="pronouns"
          label={strings.pronouns_label}
          defaultValue={profile.pronouns ?? ""}
          errors={state?.errors?.pronouns}
        />
      </div>

      <div>
        <label htmlFor="visibility" className="mb-1 block text-sm font-medium">
          {strings.visibility_label}
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={profile.visibility}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="full">{strings.visibility_full}</option>
          <option value="first_name_only">{strings.visibility_first}</option>
          <option value="initials">{strings.visibility_initials}</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">{strings.visibility_hint}</p>
      </div>

      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.message === strings.submitted_ok ||
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
        {pending ? strings.submit_pending : strings.submit}
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
