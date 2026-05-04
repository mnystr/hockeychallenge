"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Shield, Sparkles } from "@/components/icons";
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
  apply_join: string;
  apply_join_pending: string;
  team_name: string;
  team_name_ph: string;
  team_name_hint: string;
  requester_name: string;
  requester_name_ph: string;
  requester_name_hint: string;
  requester_role: string;
  requester_role_hint: string;
  requester_role_placeholder: string;
  requester_role_coach: string;
  requester_role_team_leader: string;
  requester_role_parent: string;
  requester_role_player: string;
  requester_role_other: string;
  request_note: string;
  request_note_ph: string;
  request_note_hint: string;
  submit_request: string;
  submit_request_pending: string;
  sign_out: string;
  superadmin_banner_title: string;
  superadmin_banner_body: string;
  superadmin_link: string;
};

export default function OnboardingForms({
  email,
  isSuperAdmin,
  strings,
}: {
  email: string | null;
  isSuperAdmin: boolean;
  strings: Strings;
}) {
  const [tab, setTab] = useState<Tab>("join");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      {isSuperAdmin && (
        <section className="card card-pad mb-6">
          <div className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklab, var(--ui-primary) 14%, var(--surface))",
                color: "color-mix(in oklab, var(--ui-primary) 75%, black)",
              }}
            >
              <Shield className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-tight">
                {strings.superadmin_banner_title}
              </div>
              <p className="text-sm text-muted">
                {strings.superadmin_banner_body}
              </p>
              <Link href="/admin" className="btn btn-primary btn-sm mt-3">
                {strings.superadmin_link}
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="card card-pad-lg">
        <span className="pill pill-primary inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> hockeychallenge
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {strings.welcome}
          {email ? `, ${email}` : ""}
        </h1>
        <p className="mb-6 mt-1 text-sm text-muted">{strings.intro}</p>

        <div
          className="mb-6 flex rounded-xl border border-[color:var(--border)] p-1 text-sm"
          style={{ background: "var(--surface-2)" }}
        >
          <button
            type="button"
            onClick={() => setTab("join")}
            className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${
              tab === "join"
                ? "bg-[color:var(--surface)] shadow-sm"
                : "text-muted hover:text-app-fg"
            }`}
          >
            {strings.tab_join}
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`flex-1 rounded-lg px-3 py-2 font-semibold transition ${
              tab === "create"
                ? "bg-[color:var(--surface)] shadow-sm"
                : "text-muted hover:text-app-fg"
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
      </div>

      <form action="/logout" method="post" className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm text-muted-2 hover:text-app-fg hover:underline"
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
      <Field
        name="jerseyNumber"
        label={strings.jersey_number}
        type="number"
        min={0}
        max={999}
        errors={state?.errors?.jerseyNumber}
      />

      {state?.message && (
        <p className="pill pill-danger px-3 py-2 text-sm">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg w-full"
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
        name="requesterName"
        label={strings.requester_name}
        placeholder={strings.requester_name_ph}
        errors={state?.errors?.requesterName}
        hint={strings.requester_name_hint}
        autoComplete="name"
        required
      />
      <Field
        name="proposedName"
        label={strings.team_name}
        placeholder={strings.team_name_ph}
        errors={state?.errors?.proposedName}
        hint={strings.team_name_hint}
        required
      />

      <div>
        <label htmlFor="requesterRole" className="label">
          {strings.requester_role}
        </label>
        <select
          id="requesterRole"
          name="requesterRole"
          required
          defaultValue=""
          className="input"
        >
          <option value="" disabled>
            {strings.requester_role_placeholder}
          </option>
          <option value="coach">{strings.requester_role_coach}</option>
          <option value="team_leader">
            {strings.requester_role_team_leader}
          </option>
          <option value="parent">{strings.requester_role_parent}</option>
          <option value="player">{strings.requester_role_player}</option>
          <option value="other">{strings.requester_role_other}</option>
        </select>
        <p className="hint">{strings.requester_role_hint}</p>
        {state?.errors?.requesterRole && (
          <p className="field-error">{state.errors.requesterRole[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="requestNote" className="label">
          {strings.request_note}
        </label>
        <textarea
          id="requestNote"
          name="requestNote"
          placeholder={strings.request_note_ph}
          rows={4}
          maxLength={1000}
          className="input"
        />
        <p className="hint">{strings.request_note_hint}</p>
        {state?.errors?.requestNote && (
          <p className="field-error">{state.errors.requestNote[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="pill pill-danger px-3 py-2 text-sm">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg w-full"
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
  autoComplete?: string;
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
  autoComplete,
  min,
  max,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        min={min}
        max={max}
        className="input"
      />
      {hint && <p className="hint">{hint}</p>}
      {errors && <p className="field-error">{errors[0]}</p>}
    </div>
  );
}
