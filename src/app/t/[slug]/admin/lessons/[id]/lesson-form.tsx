"use client";

import { useActionState, useState } from "react";
import { updateLesson } from "../actions";
import type { UpdateLessonFormState } from "@/lib/auth/schemas-lessons";
import {
  CHALLENGE_CARD_THEMES,
  type ChallengeCardTheme,
} from "@/lib/challenges/card-themes";
import MarkdownEditor, {
  type MarkdownEditorStrings,
} from "@/components/MarkdownEditor";

type Lesson = {
  id: string;
  title: string;
  body_md: string;
  read_points: number;
  publish_at: string | null;
  card_theme: string | null;
};

export type LessonFormStrings = {
  title: string;
  body: string;
  body_hint: string;
  read_points: string;
  read_points_hint: string;
  publish_at: string;
  publish_hint: string;
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

export default function LessonForm({
  slug,
  lesson,
  strings,
  editorStrings,
}: {
  slug: string;
  lesson: Lesson;
  strings: LessonFormStrings;
  editorStrings: MarkdownEditorStrings;
}) {
  const bound = updateLesson.bind(null, slug, lesson.id);
  const [state, action, pending] = useActionState<
    UpdateLessonFormState,
    FormData
  >(bound, undefined);
  const [cardTheme, setCardTheme] = useState<"default" | ChallengeCardTheme>(
    (lesson.card_theme as ChallengeCardTheme | null) ?? "default",
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
    state?.message === "Saved." || state?.message === strings.saved;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="title" className="label">
          {strings.title}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={lesson.title}
          required
          className="input"
        />
        {state?.errors?.title && (
          <p className="field-error">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="body_md" className="label">
          {strings.body}
        </label>
        <MarkdownEditor
          name="body_md"
          defaultValue={lesson.body_md}
          rows={14}
          strings={editorStrings}
        />
        <p className="hint">{strings.body_hint}</p>
        {state?.errors?.body_md && (
          <p className="field-error">{state.errors.body_md[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="read_points" className="label">
            {strings.read_points}
          </label>
          <input
            id="read_points"
            name="read_points"
            type="number"
            min={0}
            defaultValue={lesson.read_points.toString()}
            className="input"
          />
          <p className="hint">{strings.read_points_hint}</p>
          {state?.errors?.read_points && (
            <p className="field-error">{state.errors.read_points[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="publish_at" className="label">
            {strings.publish_at}
          </label>
          <input
            id="publish_at"
            name="publish_at"
            type="datetime-local"
            defaultValue={toLocalInput(lesson.publish_at)}
            className="input"
          />
          <p className="hint">{strings.publish_hint}</p>
          {state?.errors?.publish_at && (
            <p className="field-error">{state.errors.publish_at[0]}</p>
          )}
        </div>
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

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? strings.saving : strings.save}
      </button>
    </form>
  );
}
