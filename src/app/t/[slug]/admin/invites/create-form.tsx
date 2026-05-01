"use client";

import { useActionState } from "react";
import { createInvite, type CreateInviteFormState } from "../actions";

export type CreateInviteFormStrings = {
  code_optional: string;
  auto_generated: string;
  expires_in_days: string;
  max_uses: string;
  creating: string;
  create_invite: string;
};

export default function CreateInviteForm({
  slug,
  strings,
}: {
  slug: string;
  strings: CreateInviteFormStrings;
}) {
  const bound = createInvite.bind(null, slug);
  const [state, action, pending] = useActionState<CreateInviteFormState, FormData>(
    bound,
    undefined,
  );

  const isSuccess =
    state?.message?.startsWith("Invite created") ?? false;

  return (
    <form action={action} className="space-y-3" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          name="code"
          label={strings.code_optional}
          placeholder={strings.auto_generated}
          errors={state?.errors?.code}
          autoCapitalize="characters"
        />
        <Field
          name="expiresInDays"
          label={strings.expires_in_days}
          type="number"
          placeholder="7"
          min={1}
          max={365}
          errors={state?.errors?.expiresInDays}
        />
        <Field
          name="maxUses"
          label={strings.max_uses}
          type="number"
          placeholder="1"
          min={1}
          max={1000}
          errors={state?.errors?.maxUses}
        />
      </div>

      {state?.message && !state.errors && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={
            isSuccess
              ? {
                  background: "var(--success-bg)",
                  color: "var(--success-fg)",
                }
              : {
                  background: "var(--danger-bg)",
                  color: "var(--danger-fg)",
                }
          }
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? strings.creating : strings.create_invite}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  errors,
  placeholder,
  type = "text",
  autoCapitalize,
  min,
  max,
}: {
  name: string;
  label: string;
  errors?: string[];
  placeholder?: string;
  type?: string;
  autoCapitalize?: string;
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
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        min={min}
        max={max}
        className="input"
      />
      {errors && <p className="field-error">{errors[0]}</p>}
    </div>
  );
}
