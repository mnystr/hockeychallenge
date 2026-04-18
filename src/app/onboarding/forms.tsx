"use client";

import { useActionState, useState } from "react";
import { redeemInvite, requestTeam } from "./actions";

type Tab = "join" | "create";

export default function OnboardingForms({ email }: { email: string | null }) {
  const [tab, setTab] = useState<Tab>("join");

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">Welcome{email ? `, ${email}` : ""}</h1>
      <p className="mb-8 text-sm text-gray-500">
        You&apos;re not part of a team yet. Join one with an invite code, or request a
        new team if a coach sent you here for that.
      </p>

      <div className="mb-6 flex rounded-md border border-gray-200 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("join")}
          className={`flex-1 rounded px-3 py-2 font-medium ${
            tab === "join"
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Join a team
        </button>
        <button
          type="button"
          onClick={() => setTab("create")}
          className={`flex-1 rounded px-3 py-2 font-medium ${
            tab === "create"
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Request a new team
        </button>
      </div>

      {tab === "join" ? <JoinForm /> : <RequestForm />}

      <form action="/logout" method="post" className="mt-8 text-center">
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

function JoinForm() {
  const [state, action, pending] = useActionState(redeemInvite, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        name="code"
        label="Invite code"
        placeholder="e.g. DEMO-INVITE"
        errors={state?.errors?.code}
        autoCapitalize="characters"
        required
      />
      <Field
        name="displayName"
        label="Display name"
        placeholder="e.g. Alex N."
        errors={state?.errors?.displayName}
        hint="How this player will appear on rosters and leaderboards (team-admin must approve)."
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="jerseyNumber"
          label="Jersey # (optional)"
          type="number"
          min={0}
          max={999}
          errors={state?.errors?.jerseyNumber}
        />
        <Field
          name="pronouns"
          label="Pronouns (optional)"
          placeholder="they/them"
          errors={state?.errors?.pronouns}
        />
      </div>

      {state?.message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Apply to join"}
      </button>
    </form>
  );
}

function RequestForm() {
  const [state, action, pending] = useActionState(requestTeam, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        name="proposedName"
        label="Team name"
        placeholder="e.g. Eastside Storm U14"
        errors={state?.errors?.proposedName}
        hint="A super-admin will review before your team is created."
        required
      />

      {state?.message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}

type FieldProps = {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoCapitalize?: string;
  min?: number;
  max?: number;
};

function Field({
  name,
  label,
  errors,
  hint,
  placeholder,
  type = "text",
  required,
  autoCapitalize,
  min,
  max,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        min={min}
        max={max}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {errors && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
