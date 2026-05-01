"use client";

import { useActionState, useId, useState } from "react";
import { createTask, updateTask, deleteTask } from "../actions";
import type { TaskFormState } from "@/lib/auth/schemas-challenges";

type Task = {
  id: string;
  title: string;
  description_md: string;
  points: number | null;
  target_count: number;
  position: number;
};

export type TaskListStrings = {
  /** "Target {target}" — interpolated client-side. */
  target_template: string;
  /** "{points} pts" — interpolated client-side. */
  pts_template: string;
  edit: string;
  remove: string;
  saving: string;
  save: string;
  cancel: string;
  add_a_task: string;
  adding: string;
  add_task: string;
  task_title: string;
  description_optional: string;
  target_count: string;
  points_optional: string;
};

function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_m, k) =>
    String(vars[k] ?? `{${k}}`),
  );
}

export default function TaskList({
  slug,
  challengeId,
  tasks,
  strings,
}: {
  slug: string;
  challengeId: string;
  tasks: Task[];
  strings: TaskListStrings;
}) {
  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          slug={slug}
          challengeId={challengeId}
          task={t}
          strings={strings}
        />
      ))}

      <NewTaskForm
        slug={slug}
        challengeId={challengeId}
        strings={strings}
      />
    </div>
  );
}

function TaskRow({
  slug,
  challengeId,
  task,
  strings,
}: {
  slug: string;
  challengeId: string;
  task: Task;
  strings: TaskListStrings;
}) {
  const [editing, setEditing] = useState(false);
  const bound = updateTask.bind(null, slug, challengeId, task.id);
  const [state, action, pending] = useActionState<TaskFormState, FormData>(
    bound,
    undefined,
  );

  if (!editing) {
    return (
      <div className="card card-pad flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold tracking-tight">{task.title}</div>
          <div className="mt-0.5 text-xs text-muted">
            {interpolate(strings.target_template, { target: task.target_count })}
            {task.points !== null
              ? ` · ${interpolate(strings.pts_template, { points: task.points })}`
              : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="btn btn-secondary btn-sm"
          >
            {strings.edit}
          </button>
          <form
            action={async () => {
              await deleteTask(slug, challengeId, task.id);
            }}
          >
            <button className="btn btn-danger btn-sm">{strings.remove}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setEditing(false);
      }}
      className="card card-pad space-y-3"
      style={{
        borderColor:
          "color-mix(in oklab, var(--ui-primary) 35%, transparent)",
        background:
          "color-mix(in oklab, var(--ui-primary) 6%, var(--surface))",
      }}
      noValidate
    >
      <TaskFields state={state} defaults={task} strings={strings} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          {pending ? strings.saving : strings.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn btn-secondary btn-sm"
        >
          {strings.cancel}
        </button>
      </div>
    </form>
  );
}

function NewTaskForm({
  slug,
  challengeId,
  strings,
}: {
  slug: string;
  challengeId: string;
  strings: TaskListStrings;
}) {
  const bound = createTask.bind(null, slug, challengeId);
  const [state, action, pending] = useActionState<TaskFormState, FormData>(
    bound,
    undefined,
  );

  return (
    <form
      action={action}
      className="card card-pad space-y-3"
      style={{
        borderStyle: "dashed",
      }}
      noValidate
    >
      <p className="section-title">{strings.add_a_task}</p>
      <TaskFields state={state} strings={strings} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-sm"
      >
        {pending ? strings.adding : strings.add_task}
      </button>
    </form>
  );
}

function TaskFields({
  state,
  defaults,
  strings,
}: {
  state: TaskFormState;
  defaults?: Task;
  strings: TaskListStrings;
}) {
  const descId = useId();
  return (
    <>
      <Field
        name="title"
        label={strings.task_title}
        defaultValue={defaults?.title ?? ""}
        errors={state?.errors?.title}
        required
      />
      <div>
        <label htmlFor={descId} className="label">
          {strings.description_optional}
        </label>
        <textarea
          id={descId}
          name="description_md"
          rows={3}
          defaultValue={defaults?.description_md ?? ""}
          className="textarea input-mono"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="target_count"
          label={strings.target_count}
          type="number"
          min={1}
          defaultValue={(defaults?.target_count ?? 1).toString()}
          errors={state?.errors?.target_count}
          required
        />
        <Field
          name="points"
          label={strings.points_optional}
          type="number"
          min={0}
          defaultValue={defaults?.points?.toString() ?? ""}
          errors={state?.errors?.points}
        />
      </div>
      {state?.message &&
        state.message !== "Task added." &&
        state.message !== "Saved." && (
          <p
            className="rounded-md px-3 py-2 text-sm"
            style={{
              background: "var(--danger-bg)",
              color: "var(--danger-fg)",
            }}
          >
            {state.message}
          </p>
        )}
    </>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  errors,
  required,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  errors?: string[];
  required?: boolean;
  min?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        className="input"
      />
      {errors && <p className="field-error">{errors[0]}</p>}
    </div>
  );
}
