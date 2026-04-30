"use client";

import { useActionState } from "react";
import { createInvite, type CreateInviteFormState } from "../actions";

export default function CreateInviteForm({ slug }: { slug: string }) {
  const bound = createInvite.bind(null, slug);
  const [state, action, pending] = useActionState<CreateInviteFormState, FormData>(
    bound,
    undefined,
  );

  return (
    <form action={action} className="space-y-3" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          name="code"
          label="Code (optional)"
          placeholder="auto-generated"
          errors={state?.errors?.code}
          autoCapitalize="characters"
        />
        <Field
          name="expiresInDays"
          label="Expires in (days)"
          type="number"
          placeholder="7"
          min={1}
          max={365}
          errors={state?.errors?.expiresInDays}
        />
        <Field
          name="maxUses"
          label="Max uses"
          type="number"
          placeholder="1"
          min={1}
          max={1000}
          errors={state?.errors?.maxUses}
        />
      </div>

      {state?.message && !state.errors && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.message.startsWith("Invite created")
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
        {pending ? "Creating..." : "Create invite"}
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
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-gray-700">
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
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {errors && <p className="mt-1 text-xs text-red-600">{errors[0]}</p>}
    </div>
  );
}
