"use client";

import { useActionState, useState } from "react";
import { redeemInvite, requestTeam } from "./actions";

type Tab = "join" | "create";

type Strings = {
  welcome: string;
  intro: string;
  tab_join: string;
  tab_request: string;
  invite_code: string;
  invite_code_ph: string;
  display_name: string;
  display_name_ph: string;
  display_name_hint: string;
  jersey_number: string;
  pronouns: string;
  pronouns_ph: string;
  apply_join: string;
  apply_join_pending: string;
  team_name: string;
  team_name_ph: string;
  team_name_hint: string;
  submit_request: string;
  submit_request_pending: string;
  sign_out: string;
};

export default function OnboardingForms({
  email,
  strings,
}: {
  email: string | null;
  strings: Strings;
}) {
  const [tab, setTab] = useState<Tab>("join");

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">
        {strings.welcome}
        {email ? `, ${email}` : ""}
      </h1>
      <p className="mb-8 text-sm text-gray-500">{strings.intro}</p>

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
          {strings.tab_join}
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
          {strings.tab_request}
        </button>
      </div>

      {tab === "join" ? (
        <JoinForm strings={strings} />
      ) : (
        <RequestForm strings={strings} />
      )}

      <form action="/logout" method="post" className="mt-8 text-center">
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          {strings.sign_out}
        </button>
      </form>
    </main>
  );
}

function JoinForm({ strings }: { strings: Strings }) {
  const [state, action, pending] = useActionState(redeemInvite, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        name="code"
        label={strings.invite_code}
        placeholder={strings.invite_code_ph}
        errors={state?.errors?.code}
        autoCapitalize="characters"
        required
      />
      <Field
        name="displayName"
        label={strings.display_name}
        placeholder={strings.display_name_ph}
        errors={state?.errors?.displayName}
        hint={strings.display_name_hint}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="jerseyNumber"
          label={strings.jersey_number}
          type="number"
          min={0}
          max={999}
          errors={state?.errors?.jerseyNumber}
        />
        <Field
          name="pronouns"
          label={strings.pronouns}
          placeholder={strings.pronouns_ph}
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
        {pending ? strings.apply_join_pending : strings.apply_join}
      </button>
    </form>
  );
}

function RequestForm({ strings }: { strings: Strings }) {
  const [state, action, pending] = useActionState(requestTeam, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        name="proposedName"
        label={strings.team_name}
        placeholder={strings.team_name_ph}
        errors={state?.errors?.proposedName}
        hint={strings.team_name_hint}
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
        {pending ? strings.submit_request_pending : strings.submit_request}
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
