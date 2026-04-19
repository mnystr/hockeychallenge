"use client";

import { useActionState } from "react";
import { updatePreferences } from "./actions";

type Row = {
  teamId: string;
  teamName: string;
  email_new_challenge: boolean;
  email_leaderboard_passed: boolean;
  email_approval_needed: boolean;
  in_app_new_challenge: boolean;
  in_app_leaderboard_passed: boolean;
};

export default function PreferencesForm({ rows }: { rows: Row[] }) {
  const [state, action, pending] = useActionState<
    { message?: string } | undefined,
    FormData
  >(updatePreferences, undefined);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Join a team to set notification preferences.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      {rows.map((r) => (
        <fieldset
          key={r.teamId}
          className="rounded-md border border-gray-200 p-4"
        >
          <legend className="px-1 text-sm font-semibold">{r.teamName}</legend>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <Checkbox
              name={`${r.teamId}__in_app_new_challenge`}
              label="In-app: new challenge"
              defaultChecked={r.in_app_new_challenge}
            />
            <Checkbox
              name={`${r.teamId}__email_new_challenge`}
              label="Email: new challenge"
              defaultChecked={r.email_new_challenge}
            />
            <Checkbox
              name={`${r.teamId}__in_app_leaderboard_passed`}
              label="In-app: leaderboard passed"
              defaultChecked={r.in_app_leaderboard_passed}
            />
            <Checkbox
              name={`${r.teamId}__email_leaderboard_passed`}
              label="Email: leaderboard passed"
              defaultChecked={r.email_leaderboard_passed}
            />
            <Checkbox
              name={`${r.teamId}__email_approval_needed`}
              label="Email: approval needed (admins)"
              defaultChecked={r.email_approval_needed}
            />
          </div>
        </fieldset>
      ))}

      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.message === "Preferences saved."
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
        {pending ? "Saving..." : "Save preferences"}
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
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span>{label}</span>
    </label>
  );
}
