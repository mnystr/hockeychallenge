"use client";

import { useActionState, useState } from "react";
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

export default function TaskList({
  slug,
  challengeId,
  tasks,
}: {
  slug: string;
  challengeId: string;
  tasks: Task[];
}) {
  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <TaskRow key={t.id} slug={slug} challengeId={challengeId} task={t} />
      ))}

      <NewTaskForm slug={slug} challengeId={challengeId} />
    </div>
  );
}

function TaskRow({
  slug,
  challengeId,
  task,
}: {
  slug: string;
  challengeId: string;
  task: Task;
}) {
  const [editing, setEditing] = useState(false);
  const bound = updateTask.bind(null, slug, challengeId, task.id);
  const [state, action, pending] = useActionState<TaskFormState, FormData>(
    bound,
    undefined,
  );

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-200 p-3">
        <div>
          <div className="font-medium">{task.title}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            Target {task.target_count}
            {task.points !== null ? ` · ${task.points} pts` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Edit
          </button>
          <form
            action={async () => {
              await deleteTask(slug, challengeId, task.id);
            }}
          >
            <button className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50">
              Delete
            </button>
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
      className="space-y-3 rounded-md border border-blue-200 bg-blue-50/30 p-3"
      noValidate
    >
      <TaskFields state={state} defaults={task} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewTaskForm({
  slug,
  challengeId,
}: {
  slug: string;
  challengeId: string;
}) {
  const bound = createTask.bind(null, slug, challengeId);
  const [state, action, pending] = useActionState<TaskFormState, FormData>(
    bound,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 rounded-md border border-dashed border-gray-300 p-3" noValidate>
      <p className="text-sm font-medium text-gray-700">Add a task</p>
      <TaskFields state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add task"}
      </button>
    </form>
  );
}

function TaskFields({
  state,
  defaults,
}: {
  state: TaskFormState;
  defaults?: Task;
}) {
  return (
    <>
      <Field
        name="title"
        label="Title"
        defaultValue={defaults?.title ?? ""}
        errors={state?.errors?.title}
        required
      />
      <div>
        <label htmlFor="description_md" className="mb-1 block text-xs font-medium text-gray-700">
          Description (Markdown, optional)
        </label>
        <textarea
          id="description_md"
          name="description_md"
          rows={3}
          defaultValue={defaults?.description_md ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="target_count"
          label="Target count"
          type="number"
          min={1}
          defaultValue={(defaults?.target_count ?? 1).toString()}
          errors={state?.errors?.target_count}
          required
        />
        <Field
          name="points"
          label="Points (optional)"
          type="number"
          min={0}
          defaultValue={defaults?.points?.toString() ?? ""}
          errors={state?.errors?.points}
        />
      </div>
      {state?.message && state.message !== "Task added." && state.message !== "Saved." && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
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
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-gray-700">
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
      {errors && <p className="mt-1 text-xs text-red-600">{errors[0]}</p>}
    </div>
  );
}
