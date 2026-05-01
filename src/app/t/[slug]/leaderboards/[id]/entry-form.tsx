"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "@/components/icons";
import { addToStandaloneEntry, submitStandaloneEntry } from "../actions";
import type { StandaloneEntryFormState } from "@/lib/auth/schemas-leaderboards";

export default function StandaloneEntryForm({
  slug,
  leaderboardId,
  unit,
  currentValue,
  strings,
}: {
  slug: string;
  leaderboardId: string;
  unit: string | null;
  currentValue: number | null;
  strings: {
    value_label: string;
    submit: string;
    update: string;
    pending: string;
    saved: string;
    add_one: string;
    add_x_label: string;
    add: string;
    current_value: string;
  };
}) {
  const bound = submitStandaloneEntry.bind(null, slug, leaderboardId);
  const [state, action, pending] = useActionState<
    StandaloneEntryFormState,
    FormData
  >(bound, undefined);

  const [addPending, startAddTransition] = useTransition();
  const [addDraft, setAddDraft] = useState("1");
  const [addError, setAddError] = useState<string | null>(null);

  const runDelta = (delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    setAddError(null);
    startAddTransition(async () => {
      const res = await addToStandaloneEntry(slug, leaderboardId, delta);
      if (!res.ok) setAddError(res.message);
    });
  };

  const isSaved =
    state?.message === "Saved." || state?.message === strings.saved;

  return (
    <div className="space-y-4">
      {currentValue !== null && (
        <div className="flex items-baseline gap-2 text-sm">
          <span className="section-title">{strings.current_value}</span>
          <span className="mono text-xl font-bold text-ui-primary">
            {currentValue}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      )}

      {/* Controls in priority order: +1 → +X → Set */}
      <div className="flex flex-wrap items-end gap-3">
        {/* [+1] — most prominent */}
        <button
          type="button"
          disabled={addPending}
          onClick={() => runDelta(1)}
          className="btn-plus btn-plus-wide"
          aria-label={strings.add_one}
        >
          <Plus className="h-5 w-5" />
          <span>{strings.add_one}</span>
        </button>

        {/* [+X] — second tier */}
        <div>
          <span className="label">{strings.add_x_label}</span>
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
            <input
              type="number"
              inputMode="numeric"
              step="any"
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              disabled={addPending}
              className="w-24 border-r border-[color:var(--border)] bg-transparent px-3 text-center text-sm font-semibold focus:outline-none"
              aria-label={strings.add_x_label}
            />
            <button
              type="button"
              disabled={addPending || !Number.isFinite(Number(addDraft))}
              onClick={() => {
                const v = Number(addDraft);
                if (Number.isFinite(v) && v !== 0) runDelta(v);
              }}
              className="grid h-10 place-items-center px-3 text-sm font-semibold text-app-fg transition hover:bg-[color:var(--surface-2)] disabled:opacity-40"
            >
              {strings.add}
            </button>
          </div>
        </div>

        {/* [Set] — least prominent (collapsed) */}
        <details className="ml-auto text-sm">
          <summary className="cursor-pointer select-none rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-2 hover:bg-[color:var(--surface-2)] hover:text-app-fg">
            {strings.value_label}
          </summary>
          <form
            action={action}
            className="mt-2 flex items-stretch gap-2"
            noValidate
          >
            <input
              id="value"
              name="value"
              type="number"
              step="any"
              defaultValue={currentValue ?? ""}
              className="input input-mono w-32 text-center"
              aria-label={strings.value_label}
            />
            <button
              type="submit"
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              {pending
                ? strings.pending
                : currentValue === null
                  ? strings.submit
                  : strings.update}
            </button>
          </form>
          {state?.errors?.value && (
            <p className="field-error">{state.errors.value[0]}</p>
          )}
          {state?.message && (
            <p
              className="mt-2 rounded-md px-3 py-2 text-xs font-medium"
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
        </details>
      </div>

      {addError && (
        <p
          className="rounded-md px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger-fg)",
          }}
        >
          {addError}
        </p>
      )}
    </div>
  );
}
