"use client";

import { useActionState } from "react";
import { requestAccountDeletion } from "./actions";

type Strings = {
  confirm_label: string;
  confirm_verify: string;
  confirm_word: string;
  confirm_error: string;
  cta: string;
  cta_pending: string;
};

export default function DeleteAccountForm({ strings }: { strings: Strings }) {
  const [state, action, pending] = useActionState<
    { message?: string } | undefined,
    FormData
  >(requestAccountDeletion, undefined);

  return (
    <form action={action} className="space-y-3" noValidate>
      <label className="block text-sm">
        <span className="text-app-fg">
          {strings.confirm_label}{" "}
          <span className="mono font-semibold">{strings.confirm_word}</span>{" "}
          {strings.confirm_verify}
        </span>
        <input
          name="confirm"
          className="input mt-1.5"
          autoComplete="off"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 35%, transparent)",
          }}
        />
      </label>
      {state?.message && (
        <p className="pill pill-danger px-3 py-2 text-sm">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn"
        style={{
          background: "var(--danger)",
          color: "#fff",
          boxShadow:
            "0 6px 16px -6px color-mix(in oklab, var(--danger) 60%, transparent)",
        }}
      >
        {pending ? strings.cta_pending : strings.cta}
      </button>
    </form>
  );
}
