"use client";

import { useActionState } from "react";
import {
  submitTeamRename,
  type TeamRenameFormState,
} from "./actions";

export default function RenameForm({
  slug,
  currentName,
  pending,
  strings,
}: {
  slug: string;
  currentName: string;
  pending: { proposed_name: string; created_at: string } | null;
  strings: {
    label: string;
    hint: string;
    submit: string;
    submitting: string;
    submitted_ok: string;
    pending_banner: string;
    superseded_note: string;
  };
}) {
  const bound = submitTeamRename.bind(null, slug);
  const [state, action, isSubmitting] = useActionState<
    TeamRenameFormState,
    FormData
  >(bound, undefined);

  const isSuccess =
    state?.message === "Submitted." || state?.message === strings.submitted_ok;

  return (
    <form action={action} className="space-y-3" noValidate>
      {pending && (
        <p
          className="card card-pad text-sm"
          style={{
            background: "var(--warning-bg)",
            borderColor:
              "color-mix(in oklab, var(--warning) 35%, transparent)",
            color: "var(--warning-fg)",
          }}
        >
          <span className="font-semibold">{strings.pending_banner}</span>{" "}
          <span className="font-medium">{pending.proposed_name}</span>
          <span className="ml-1 text-xs opacity-80">
            ({new Date(pending.created_at).toLocaleString()})
          </span>
          <br />
          <span className="text-xs opacity-80">{strings.superseded_note}</span>
        </p>
      )}

      <div>
        <label htmlFor="proposed_name" className="label">
          {strings.label}
        </label>
        <input
          id="proposed_name"
          name="proposed_name"
          type="text"
          defaultValue={currentName}
          minLength={2}
          maxLength={80}
          className="input"
        />
        <p className="hint">{strings.hint}</p>
      </div>

      {state?.error && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger-fg)",
          }}
        >
          {state.error}
        </p>
      )}
      {isSuccess && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={{
            background: "var(--success-bg)",
            color: "var(--success-fg)",
          }}
        >
          {strings.submitted_ok}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary"
      >
        {isSubmitting ? strings.submitting : strings.submit}
      </button>
    </form>
  );
}
