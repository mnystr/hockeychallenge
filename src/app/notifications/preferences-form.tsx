"use client";

import { useActionState } from "react";
import { updatePreferences } from "./actions";

type Row = {
  teamId: string;
  teamName: string;
  email_new_challenge: boolean;
  email_new_lesson: boolean;
  email_leaderboard_passed: boolean;
  email_approval_needed: boolean;
  in_app_new_challenge: boolean;
  in_app_new_lesson: boolean;
  in_app_leaderboard_passed: boolean;
};

type Strings = {
  empty: string;
  save: string;
  save_pending: string;
  saved: string;
  in_app_new_challenge: string;
  email_new_challenge: string;
  in_app_new_lesson: string;
  email_new_lesson: string;
  in_app_leaderboard_passed: string;
  email_leaderboard_passed: string;
  email_approval_needed: string;
};

export default function PreferencesForm({
  rows,
  strings,
}: {
  rows: Row[];
  strings: Strings;
}) {
  const [state, action, pending] = useActionState<
    { message?: string } | undefined,
    FormData
  >(updatePreferences, undefined);

  if (rows.length === 0) {
    return <p className="card card-pad text-sm text-muted">{strings.empty}</p>;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {rows.map((r) => (
        <fieldset key={r.teamId} className="card card-pad">
          <legend className="px-2 text-sm font-bold tracking-tight">
            {r.teamName}
          </legend>
          <div className="mt-2 grid gap-2.5 text-sm sm:grid-cols-2">
            <Checkbox
              name={`${r.teamId}__in_app_new_challenge`}
              label={strings.in_app_new_challenge}
              defaultChecked={r.in_app_new_challenge}
            />
            <Checkbox
              name={`${r.teamId}__email_new_challenge`}
              label={strings.email_new_challenge}
              defaultChecked={r.email_new_challenge}
            />
            <Checkbox
              name={`${r.teamId}__in_app_new_lesson`}
              label={strings.in_app_new_lesson}
              defaultChecked={r.in_app_new_lesson}
            />
            <Checkbox
              name={`${r.teamId}__email_new_lesson`}
              label={strings.email_new_lesson}
              defaultChecked={r.email_new_lesson}
            />
            <Checkbox
              name={`${r.teamId}__in_app_leaderboard_passed`}
              label={strings.in_app_leaderboard_passed}
              defaultChecked={r.in_app_leaderboard_passed}
            />
            <Checkbox
              name={`${r.teamId}__email_leaderboard_passed`}
              label={strings.email_leaderboard_passed}
              defaultChecked={r.email_leaderboard_passed}
            />
            <Checkbox
              name={`${r.teamId}__email_approval_needed`}
              label={strings.email_approval_needed}
              defaultChecked={r.email_approval_needed}
            />
          </div>
        </fieldset>
      ))}

      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            state.message === strings.saved ||
            state.message === "Preferences saved."
              ? "pill pill-success"
              : "pill pill-danger"
          }`}
        >
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? strings.save_pending : strings.save}
      </button>
    </form>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-[color:var(--border)] accent-[color:var(--ui-primary)]"
      />
      <span>{label}</span>
    </label>
  );
}
