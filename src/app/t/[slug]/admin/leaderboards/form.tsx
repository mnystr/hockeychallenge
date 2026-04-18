"use client";

import { useActionState, useState } from "react";
import {
  createLeaderboard,
  updateLeaderboard,
} from "./actions";
import type { LeaderboardFormState } from "@/lib/auth/schemas-leaderboards";

type Leaderboard = {
  id: string;
  name: string;
  description: string;
  kind: "points" | "standalone";
  sort_order: "desc" | "asc";
  unit: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LeaderboardForm({
  slug,
  leaderboard,
}: {
  slug: string;
  leaderboard?: Leaderboard;
}) {
  const action = leaderboard
    ? updateLeaderboard.bind(null, slug, leaderboard.id)
    : createLeaderboard.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    LeaderboardFormState,
    FormData
  >(action, undefined);
  const [kind, setKind] = useState(leaderboard?.kind ?? "points");

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        name="name"
        label="Name"
        defaultValue={leaderboard?.name ?? ""}
        errors={state?.errors?.name}
        required
      />

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={leaderboard?.description ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="mb-1 block text-sm font-medium">
            Kind
          </label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            disabled={!!leaderboard}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
          >
            <option value="points">Points (from challenges)</option>
            <option value="standalone">Standalone (players enter value)</option>
          </select>
          {leaderboard && (
            <p className="mt-1 text-xs text-gray-500">
              Can&apos;t change kind after creation.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="sort_order"
            className="mb-1 block text-sm font-medium"
          >
            Sort
          </label>
          <select
            id="sort_order"
            name="sort_order"
            defaultValue={leaderboard?.sort_order ?? "desc"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="desc">Higher is better</option>
            <option value="asc">Lower is better</option>
          </select>
        </div>

        {kind === "standalone" && (
          <Field
            name="unit"
            label="Unit (optional)"
            defaultValue={leaderboard?.unit ?? ""}
            errors={state?.errors?.unit}
            hint="e.g. shots, minutes, laps"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          name="starts_at"
          label="Starts at (optional)"
          type="datetime-local"
          defaultValue={toLocalInput(leaderboard?.starts_at ?? null)}
          errors={state?.errors?.starts_at}
        />
        <Field
          name="ends_at"
          label="Ends at (optional)"
          type="datetime-local"
          defaultValue={toLocalInput(leaderboard?.ends_at ?? null)}
          errors={state?.errors?.ends_at}
          hint="Completions outside [starts, ends) don't count. Archive afterwards to snapshot rankings."
        />
      </div>

      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.message === "Saved."
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
        {pending ? "Saving..." : leaderboard ? "Save" : "Create"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  errors,
  hint,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  errors?: string[];
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {errors && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
