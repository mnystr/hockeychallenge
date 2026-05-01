import { z } from "zod";
import { CHALLENGE_CARD_THEMES } from "@/lib/challenges/card-themes";

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), {
      error: `Must be an integer between ${min} and ${max}.`,
    });

const optionalTimestamp = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    // datetime-local inputs come through without timezone; treat as local.
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  });

export const updateChallengeSchema = z
  .object({
    title: z.string().min(1, { error: "Title required." }).max(200).trim(),
    description_md: z.string().max(10_000).default(""),
    completion_points: optionalNumber(0, 100_000),
    completion_mode: z.enum(["all_tasks", "x_of_y"]),
    required_task_count: optionalNumber(1, 1000),
    publish_at: optionalTimestamp,
    starts_at: optionalTimestamp,
    ends_at: optionalTimestamp,
    recurrence: z.enum(["none", "weekly", "monthly"]),
    card_theme: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v !== "default" ? v : null))
      .refine(
        (v) =>
          v === null ||
          (CHALLENGE_CARD_THEMES as readonly string[]).includes(v),
        { error: "Unknown card theme." },
      ),
  })
  .refine(
    (v) =>
      v.completion_mode !== "x_of_y" || v.required_task_count !== null,
    {
      message: "Required task count is required when mode is 'X of Y'.",
      path: ["required_task_count"],
    },
  )
  .refine(
    (v) =>
      v.starts_at === null ||
      v.ends_at === null ||
      new Date(v.ends_at) > new Date(v.starts_at),
    { message: "Ends at must be after starts at.", path: ["ends_at"] },
  );

export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;

export type UpdateChallengeFormState =
  | {
      errors?: Partial<Record<keyof UpdateChallengeInput, string[]>>;
      message?: string;
    }
  | undefined;

export const taskSchema = z.object({
  title: z.string().min(1, { error: "Title required." }).max(200).trim(),
  description_md: z.string().max(10_000).default(""),
  points: optionalNumber(0, 100_000),
  target_count: z
    .string()
    .trim()
    .default("1")
    .transform((v) => Number(v || "1"))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100_000, {
      error: "Target count must be 1 or more.",
    }),
});

export type TaskInput = z.infer<typeof taskSchema>;
export type TaskFormState =
  | {
      errors?: Partial<Record<keyof TaskInput, string[]>>;
      message?: string;
    }
  | undefined;
