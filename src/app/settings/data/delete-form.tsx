"use client";

import { useActionState } from "react";
import { requestAccountDeletion } from "./actions";

export default function DeleteAccountForm() {
  const [state, action, pending] = useActionState<
    { message?: string } | undefined,
    FormData
  >(requestAccountDeletion, undefined);

  return (
    <form action={action} className="space-y-3" noValidate>
      <label className="block text-sm">
        Type <span className="font-mono font-semibold">DELETE</span> to
        confirm:
        <input
          name="confirm"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          autoComplete="off"
        />
      </label>
      {state?.message && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Deleting..." : "Delete my account"}
      </button>
    </form>
  );
}
