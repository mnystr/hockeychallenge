"use client";

import { useActionState, useState } from "react";
import { updateChallenge } from "../actions";
import type { UpdateChallengeFormState } from "@/lib/auth/schemas-challenges";
import {
  CHALLENGE_CARD_THEMES,
  type ChallengeCardTheme,
} from "@/lib/challenges/card-themes";

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
  card_theme: string | null;
};

export type ChallengeFormStrings = {
  title: string;
  description: string;
  description_hint: string;
  completion_mode: string;
  mode_all: string;
  mode_xy: string;
  required_count: string;
  points_optional: string;
  points_hint: string;
  recurrence: string;
  recurrence_none: string;
  recurrence_weekly: string;
  recurrence_monthly: string;
  publish_at: string;
  publish_hint: string;
  starts_at: string;
  ends_at: string;
  saving: string;
  save: string;
  saved: string;
  card_theme_label: string;
  card_theme_hint: string;
  card_theme_default: string;
  card_theme_aurora: string;
  card_theme_inferno: string;
  card_theme_glacier: string;
  card_theme_forest: string;
  card_theme_sunset: string;
  card_theme_lightning: string;
  card_theme_royal: string;
  card_theme_ocean: string;
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
  strings,
}: {
  slug: string;
  challenge: Challenge;
  strings: ChallengeFormStrings;
}) {
  const bound = updateChallenge.bind(null, slug, challenge.id);
  const [state, action, pending] = useActionState<
    UpdateChallengeFormState,
    FormData
  >(bound, undefined);
  const [mode, setMode] = useState(challenge.completion_mode);
  const [cardTheme, setCardTheme] = useState<"default" | ChallengeCardTheme>(
    (challenge.card_theme as ChallengeCardTheme | null) ?? "default",
  );

  const themeLabel: Record<"default" | ChallengeCardTheme, string> = {
    default: strings.card_theme_default,
    aurora: strings.card_theme_aurora,
    inferno: strings.card_theme_inferno,
    glacier: strings.card_theme_glacier,
    forest: strings.card_theme_forest,
    sunset: strings.card_theme_sunset,
    lightning: strings.card_theme_lightning,
    royal: strings.card_theme_royal,
    ocean: strings.card_theme_ocean,
  };

  // The server action returns the literal "Saved." regardless of locale, but
  // future-proof against a translated success message too.
  const isSaved =
    state?.message === "Saved." || state?.message === strings.saved;

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        name="title"
        label={strings.title}
        defaultValue={challenge.title}
        errors={state?.errors?.title}
        required
      />

      <div>
        <label htmlFor="description_md" className="label">
          {strings.description}
        </label>
        <textarea
          id="description_md"
          name="description_md"
          rows={8}
          defaultValue={challenge.description_md}
          className="textarea input-mono"
        />
        <p className="hint">{strings.description_hint}</p>
        {state?.errors?.description_md && (
          <p className="field-error">{state.errors.description_md[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="completion_mode" className="label">
            {strings.completion_mode}
          </label>
          <select
            id="completion_mode"
            name="completion_mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="select"
          >
            <option value="all_tasks">{strings.mode_all}</option>
            <option value="x_of_y">{strings.mode_xy}</option>
          </select>
        </div>

        {mode === "x_of_y" && (
          <Field
            name="required_task_count"
            label={strings.required_count}
            type="number"
            min={1}
            defaultValue={challenge.required_task_count?.toString() ?? ""}
            errors={state?.errors?.required_task_count}
          />
        )}

        <Field
          name="completion_points"
          label={strings.points_optional}
          type="number"
          min={0}
          defaultValue={challenge.completion_points?.toString() ?? ""}
          errors={state?.errors?.completion_points}
          hint={strings.points_hint}
        />

        <div>
          <label htmlFor="recurrence" className="label">
            {strings.recurrence}
          </label>
          <select
            id="recurrence"
            name="recurrence"
            defaultValue={challenge.recurrence}
            className="select"
          >
            <option value="none">{strings.recurrence_none}</option>
            <option value="weekly">{strings.recurrence_weekly}</option>
            <option value="monthly">{strings.recurrence_monthly}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          name="publish_at"
          label={strings.publish_at}
          type="datetime-local"
          defaultValue={toLocalInput(challenge.publish_at)}
          errors={state?.errors?.publish_at}
          hint={strings.publish_hint}
        />
        <Field
          name="starts_at"
          label={strings.starts_at}
          type="datetime-local"
          defaultValue={toLocalInput(challenge.starts_at)}
          errors={state?.errors?.starts_at}
        />
        <Field
          name="ends_at"
          label={strings.ends_at}
          type="datetime-local"
          defaultValue={toLocalInput(challenge.ends_at)}
          errors={state?.errors?.ends_at}
        />
      </div>

      <div>
        <span className="label">{strings.card_theme_label}</span>
        <p className="hint mb-2 mt-0">{strings.card_theme_hint}</p>
        <input type="hidden" name="card_theme" value={cardTheme} />
        <div className="theme-swatch-grid">
          {(["default", ...CHALLENGE_CARD_THEMES] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              data-theme={opt}
              onClick={() => setCardTheme(opt)}
              className={`theme-swatch ${cardTheme === opt ? "is-selected" : ""}`}
              aria-pressed={cardTheme === opt}
            >
              {themeLabel[opt]}
            </button>
          ))}
        </div>
        {state?.errors?.card_theme && (
          <p className="field-error">{state.errors.card_theme[0]}</p>
        )}
      </div>

      {state?.message && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={
            isSaved
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
          {isSaved ? strings.saved : state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? strings.saving : strings.save}
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
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        className="input"
      />
      {hint && <p className="hint">{hint}</p>}
      {errors && <p className="field-error">{errors[0]}</p>}
    </div>
  );
}
