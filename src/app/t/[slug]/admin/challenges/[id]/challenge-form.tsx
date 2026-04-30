"use client";

import { useActionState, useState } from "react";
import { updateChallenge } from "../actions";
import type { UpdateChallengeFormState } from "@/lib/auth/schemas-challenges";

type Challenge = {
  id: string;
  title: string;
  description_md: string;
  completion_points: number | null;
  completion_mode: "all_tasks" | "x_of_y";
  required_task_count: number | null;
  publish_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  recurrence: "none" | "weekly" | "monthly";
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ChallengeForm({
  slug,
  challenge,
}: {
  slug: string;
  challenge: Challenge;
}) {
  const bound = updateChallenge.bind(null, slug, challenge.id);
  const [state, action, pending] = useActionState<
    UpdateChallengeFormState,
    FormData
  >(bound, undefined);
  const [mode, setMode] = useState(challenge.completion_mode);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field name="title" label="Title" defaultValue={challenge.title} errors={state?.errors?.title} required />

      <div>
        <label htmlFor="description_md" className="mb-1 block text-sm font-medium">
          Description (Markdown)
        </label>
        <textarea
          id="description_md"
          name="description_md"
          rows={8}
          defaultValue={challenge.description_md}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Use standard Markdown. Headings, lists, bold, links, and images via{" "}
          <code>![alt](url)</code> all work.
        </p>
        {state?.errors?.description_md && (
          <p className="mt-1 text-sm text-red-600">
            {state.errors.description_md[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="completion_mode" className="mb-1 block text-sm font-medium">
            Completion mode
          </label>
          <select
            id="completion_mode"
            name="completion_mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all_tasks">Complete all tasks</option>
            <option value="x_of_y">X of Y tasks</option>
          </select>
        </div>

        {mode === "x_of_y" && (
          <Field
            name="required_task_count"
            label="Required task count"
            type="number"
            min={1}
            defaultValue={challenge.required_task_count?.toString() ?? ""}
            errors={state?.errors?.required_task_count}
          />
        )}

        <Field
          name="completion_points"
          label="Challenge points (optional bonus)"
          type="number"
          min={0}
          defaultValue={challenge.completion_points?.toString() ?? ""}
          errors={state?.errors?.completion_points}
          hint="Awarded on top of task points when the challenge is complete."
        />

        <div>
          <label htmlFor="recurrence" className="mb-1 block text-sm font-medium">
            Recurrence
          </label>
          <select
            id="recurrence"
            name="recurrence"
            defaultValue={challenge.recurrence}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="none">One-off</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          name="publish_at"
          label="Publish at"
          type="datetime-local"
          defaultValue={toLocalInput(challenge.publish_at)}
          errors={state?.errors?.publish_at}
          hint="When the challenge appears to players. Blank = visible immediately once published."
        />
        <Field
          name="starts_at"
          label="Starts at"
          type="datetime-local"
          defaultValue={toLocalInput(challenge.starts_at)}
          errors={state?.errors?.starts_at}
        />
        <Field
          name="ends_at"
          label="Ends at"
          type="datetime-local"
          defaultValue={toLocalInput(challenge.ends_at)}
          errors={state?.errors?.ends_at}
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
        {pending ? "Saving..." : "Save"}
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
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  errors?: string[];
  hint?: string;
  required?: boolean;
  min?: number;
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
        min={min}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {errors && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
