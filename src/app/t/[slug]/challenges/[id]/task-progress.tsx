"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Plus } from "@/components/icons";
import { addTaskProgress, setTaskProgress } from "../actions";

export default function TaskProgress({
  slug,
  challengeId,
  taskId,
  currentCount,
  targetCount,
  locked,
  strings,
}: {
  slug: string;
  challengeId: string;
  taskId: string;
  currentCount: number;
  targetCount: number;
  locked: boolean;
  strings: {
    mark_done: string;
    done: string;
    target_met: string;
    add_one: string;
    submit_partial: string;
    progress_label: string;
    add_x_label: string;
    add: string;
    set_label: string;
    set: string;
  };
}) {
  const [count, setCount] = useState(currentCount);
  const [pending, startTransition] = useTransition();
  const [setDraft, setSetDraft] = useState(String(currentCount));
  const [addDraft, setAddDraft] = useState("1");
  const [justBumped, setJustBumped] = useState(false);
  const [seenProp, setSeenProp] = useState(currentCount);
  const [error, setError] = useState<string | null>(null);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React docs pattern: reset local state when a key prop changes.
  if (seenProp !== currentCount) {
    setSeenProp(currentCount);
    setCount(currentCount);
    setSetDraft(String(currentCount));
  }

  useEffect(() => {
    return () => {
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
    };
  }, []);

  const met = count >= targetCount;
  const pct = targetCount > 0 ? Math.min(100, (count / targetCount) * 100) : 0;

  const flashBump = () => {
    setJustBumped(true);
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => setJustBumped(false), 380);
  };

  const runDelta = (delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    setError(null);
    flashBump();
    // Optimistically reflect the change so the bar moves immediately.
    setCount((c) => Math.max(0, Math.min(100_000, c + Math.floor(delta))));
    startTransition(async () => {
      const res = await addTaskProgress(slug, challengeId, taskId, delta);
      if (!res.ok) {
        setError(res.message);
        // Roll back optimistic update on failure.
        setCount(currentCount);
      } else {
        setCount(res.value);
        setSetDraft(String(res.value));
      }
    });
  };

  const runSet = (next: number) => {
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(0, Math.min(100_000, Math.floor(next)));
    setError(null);
    setCount(clamped);
    setSetDraft(String(clamped));
    if (clamped > currentCount) flashBump();
    startTransition(async () => {
      await setTaskProgress(slug, challengeId, taskId, clamped);
    });
  };

  // Single-shot tasks (target_count === 1) → big toggle button.
  if (targetCount === 1) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={locked || pending}
          onClick={() => runSet(met ? 0 : 1)}
          className={met ? "btn btn-lg" : "btn btn-primary btn-lg"}
          style={
            met
              ? {
                  background: "var(--success-bg)",
                  color: "var(--success-fg)",
                  border:
                    "1px solid color-mix(in oklab, var(--success) 35%, transparent)",
                }
              : undefined
          }
          aria-pressed={met}
        >
          {met ? (
            <>
              <Check className="h-4 w-4" />
              {strings.done}
            </>
          ) : (
            strings.mark_done
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar with label */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted">
            {strings.progress_label}
          </span>
          <span
            className={`mono font-semibold ${met ? "" : "text-app-fg"}`}
            style={met ? { color: "var(--success)" } : undefined}
          >
            {count}
            <span className="text-muted-2"> / {targetCount}</span>
            {met && (
              <span className="ml-2 text-xs font-bold uppercase tracking-wider">
                {strings.target_met}
              </span>
            )}
          </span>
        </div>
        <div className="progress" aria-label={`${count}/${targetCount}`}>
          <div
            className={`progress-fill ${met ? "is-complete" : ""} ${pending && !met ? "is-pending" : ""} ${justBumped ? "" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Controls in priority order: +1 → +X → Set */}
      <div className="flex flex-wrap items-end gap-3">
        {/* [+1] — most prominent */}
        <button
          type="button"
          disabled={locked || pending || met}
          onClick={() => runDelta(1)}
          className={`btn-plus btn-plus-wide ${justBumped ? "ring-2 ring-white/40" : ""}`}
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
              step="1"
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              disabled={locked || pending}
              className="w-20 border-r border-[color:var(--border)] bg-transparent px-2 text-center text-sm font-semibold focus:outline-none"
              aria-label={strings.add_x_label}
            />
            <button
              type="button"
              disabled={
                locked || pending || met ||
                !Number.isFinite(Number(addDraft))
              }
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

        {/* [Set] — least prominent (ghost) */}
        <details className="ml-auto text-sm">
          <summary className="cursor-pointer select-none rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-2 hover:bg-[color:var(--surface-2)] hover:text-app-fg">
            {strings.set_label}
          </summary>
          <div className="mt-2 flex items-stretch gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={setDraft}
              onChange={(e) => setSetDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              disabled={locked || pending}
              className="input w-24 text-center"
              aria-label={strings.set_label}
            />
            <button
              type="button"
              disabled={locked || pending}
              onClick={() => {
                const v = Number(setDraft);
                if (Number.isFinite(v)) runSet(v);
              }}
              className="btn btn-ghost btn-sm"
            >
              {strings.set}
            </button>
          </div>
        </details>
      </div>

      {error && (
        <p
          className="rounded-md px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger-fg)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
