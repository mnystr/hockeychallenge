"use client";

import { useActionState, useState } from "react";
import {
  createLeaderboard,
  updateLeaderboard,
} from "./actions";
import type { LeaderboardFormState } from "@/lib/auth/schemas-leaderboards";
import {
  CHALLENGE_CARD_THEMES,
  type ChallengeCardTheme,
} from "@/lib/challenges/card-themes";
import MarkdownEditor, {
  type MarkdownEditorStrings,
} from "@/components/MarkdownEditor";

type Leaderboard = {
  id: string;
  name: string;
  description: string;
  kind: "points" | "standalone";
  sort_order: "desc" | "asc";
  unit: string | null;
  starts_at: string | null;
  ends_at: string | null;
  card_theme: string | null;
};

export type LeaderboardFormStrings = {
  form_name: string;
  form_description: string;
  form_kind: string;
  form_kind_points: string;
  form_kind_standalone: string;
  form_kind_locked: string;
  form_sort: string;
  form_sort_higher: string;
  form_sort_lower: string;
  form_unit_optional: string;
  form_unit_ph: string;
  form_starts_at_optional: string;
  form_ends_at_optional: string;
  form_window_hint: string;
  form_saving: string;
  form_save: string;
  form_create: string;
  form_saved: string;
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

export default function LeaderboardForm({
  slug,
  leaderboard,
  strings,
  editorStrings,
}: {
  slug: string;
  leaderboard?: Leaderboard;
  strings: LeaderboardFormStrings;
  editorStrings: MarkdownEditorStrings;
}) {
  const action = leaderboard
    ? updateLeaderboard.bind(null, slug, leaderboard.id)
    : createLeaderboard.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    LeaderboardFormState,
    FormData
  >(action, undefined);
  const [kind, setKind] = useState(leaderboard?.kind ?? "points");
  const [cardTheme, setCardTheme] = useState<"default" | ChallengeCardTheme>(
    (leaderboard?.card_theme as ChallengeCardTheme | null) ?? "default",
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

  const isSaved =
    state?.message === "Saved." || state?.message === strings.form_saved;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        name="name"
        label={strings.form_name}
        defaultValue={leaderboard?.name ?? ""}
        errors={state?.errors?.name}
        required
      />

      <div>
        <label htmlFor="description" className="label">
          {strings.form_description}
        </label>
        <MarkdownEditor
          name="description"
          defaultValue={leaderboard?.description ?? ""}
          rows={3}
          strings={editorStrings}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="label">
            {strings.form_kind}
          </label>
          <select
            id="kind"
            // When editing, the visible select is disabled. A disabled
            // form control is omitted from FormData, which then fails
            // schema validation. Use a hidden input to always submit
            // the kind, and leave this control nameless when locked.
            name={leaderboard ? undefined : "kind"}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            disabled={!!leaderboard}
            className="select"
          >
            <option value="points">{strings.form_kind_points}</option>
            <option value="standalone">{strings.form_kind_standalone}</option>
          </select>
          {leaderboard && (
            <>
              <input type="hidden" name="kind" value={kind} />
              <p className="hint">{strings.form_kind_locked}</p>
            </>
          )}
        </div>

        <div>
          <label htmlFor="sort_order" className="label">
            {strings.form_sort}
          </label>
          <select
            id="sort_order"
            name="sort_order"
            defaultValue={leaderboard?.sort_order ?? "desc"}
            className="select"
          >
            <option value="desc">{strings.form_sort_higher}</option>
            <option value="asc">{strings.form_sort_lower}</option>
          </select>
        </div>

        {kind === "standalone" && (
          <Field
            name="unit"
            label={strings.form_unit_optional}
            defaultValue={leaderboard?.unit ?? ""}
            errors={state?.errors?.unit}
            hint={strings.form_unit_ph}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          name="starts_at"
          label={strings.form_starts_at_optional}
          type="datetime-local"
          defaultValue={toLocalInput(leaderboard?.starts_at ?? null)}
          errors={state?.errors?.starts_at}
        />
        <Field
          name="ends_at"
          label={strings.form_ends_at_optional}
          type="datetime-local"
          defaultValue={toLocalInput(leaderboard?.ends_at ?? null)}
          errors={state?.errors?.ends_at}
          hint={strings.form_window_hint}
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
          {isSaved ? strings.form_saved : state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending
          ? strings.form_saving
          : leaderboard
            ? strings.form_save
            : strings.form_create}
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
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="input"
      />
      {hint && <p className="hint">{hint}</p>}
      {errors && <p className="field-error">{errors[0]}</p>}
    </div>
  );
}
