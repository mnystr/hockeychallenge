"use client";

import { useActionState } from "react";
import { submitProfileChange } from "./actions";
import type { ProfileChangeFormState } from "@/lib/auth/schemas-profile";

type Profile = {
  id: string;
  display_name: string;
  jersey_number: number | null;
  visibility: "full" | "first_name_only" | "initials";
  picture_url: string | null;
};

type Strings = {
  display_name_label: string;
  display_name_hint: string;
  jersey_label: string;
  visibility_label: string;
  visibility_full: string;
  visibility_first: string;
  visibility_initials: string;
  visibility_hint: string;
  picture_label: string;
  picture_hint: string;
  picture_current: string;
  picture_none: string;
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
    <form
      action={action}
      className="card card-pad-lg space-y-5"
      noValidate
    >
      <Field
        name="display_name"
        label={strings.display_name_label}
        defaultValue={profile.display_name}
        errors={state?.errors?.display_name}
        hint={strings.display_name_hint}
      />

      <Field
        name="jersey_number"
        label={strings.jersey_label}
        type="number"
        min={0}
        max={999}
        defaultValue={profile.jersey_number?.toString() ?? ""}
        errors={state?.errors?.jersey_number}
      />

      <div>
        <label htmlFor="visibility" className="label">
          {strings.visibility_label}
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={profile.visibility}
          className="select"
        >
          <option value="full">{strings.visibility_full}</option>
          <option value="first_name_only">{strings.visibility_first}</option>
          <option value="initials">{strings.visibility_initials}</option>
        </select>
        <p className="hint">{strings.visibility_hint}</p>
      </div>

      <div>
        <label htmlFor="picture" className="label">
          {strings.picture_label}
        </label>
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {profile.picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.picture_url}
                alt={strings.picture_current}
                className="avatar avatar-lg object-cover"
              />
            ) : (
              <div className="avatar avatar-lg text-[0.62rem] leading-tight">
                {strings.picture_none}
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              id="picture"
              name="picture"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-[color:var(--border)] file:bg-[color:var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-semibold hover:file:bg-[color:var(--surface-2)]"
            />
            <p className="hint">{strings.picture_hint}</p>
          </div>
        </div>
      </div>

      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            state.message === strings.submitted_ok ||
            state.message.startsWith("Submitted") ||
            state.message.startsWith("Skickat")
              ? "pill pill-success"
              : "pill pill-danger"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg"
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
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="input"
      />
      {hint && <p className="hint">{hint}</p>}
      {errors && <p className="field-error">{errors[0]}</p>}
    </div>
  );
}
