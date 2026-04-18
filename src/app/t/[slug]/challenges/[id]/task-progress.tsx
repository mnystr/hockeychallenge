"use client";

import { useState, useTransition } from "react";
import { setTaskProgress } from "../actions";

export default function TaskProgress({
  slug,
  challengeId,
  taskId,
  currentCount,
  targetCount,
  locked,
}: {
  slug: string;
  challengeId: string;
  taskId: string;
  currentCount: number;
  targetCount: number;
  locked: boolean;
}) {
  const [count, setCount] = useState(currentCount);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(String(currentCount));

  const met = count >= targetCount;

  const update = (next: number) => {
    const clamped = Math.max(0, next);
    setCount(clamped);
    setDraft(String(clamped));
    startTransition(async () => {
      await setTaskProgress(slug, challengeId, taskId, clamped);
    });
  };

  if (targetCount === 1) {
    // Simple toggle — a "done" button for one-shot tasks.
    return (
      <button
        type="button"
        disabled={locked || pending}
        onClick={() => update(met ? 0 : 1)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          met
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-blue-600 text-white hover:bg-blue-700"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {met ? "Done ✓" : "Mark done"}
      </button>
    );
  }

  // Counter for tasks with a target > 1.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={locked || pending || count <= 0}
          onClick={() => update(count - 1)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => update(Number(draft || 0))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          disabled={locked || pending}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          disabled={locked || pending}
          onClick={() => update(count + 1)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          +
        </button>
      </div>
      <div className="text-xs text-gray-500">
        / {targetCount}{" "}
        {met ? (
          <span className="ml-1 font-medium text-green-700">done</span>
        ) : null}
      </div>
    </div>
  );
}
