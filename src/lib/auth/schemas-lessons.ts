import { z } from "zod";
import { CHALLENGE_CARD_THEMES } from "@/lib/challenges/card-themes";

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

export const updateLessonSchema = z.object({
  title: z.string().min(1, { error: "Title required." }).max(200).trim(),
  body_md: z.string().max(30_000).default(""),
  read_points: z
    .string()
    .trim()
    .default("0")
    .transform((v) => Number(v || "0"))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 100_000, {
      error: "Read points must be an integer between 0 and 100000.",
    }),
  publish_at: optionalTimestamp,
  card_theme: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "default" ? v : null))
    .refine(
      (v) =>
        v === null || (CHALLENGE_CARD_THEMES as readonly string[]).includes(v),
      { error: "Unknown card theme." },
    ),
});

export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export type UpdateLessonFormState =
  | {
      errors?: Partial<Record<keyof UpdateLessonInput, string[]>>;
      message?: string;
    }
  | undefined;

export const lessonLinkSchema = z
  .object({
    challenge_id: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    leaderboard_id: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => (v.challenge_id === null) !== (v.leaderboard_id === null), {
    message: "Pick exactly one challenge or leaderboard.",
  });

export type LessonLinkInput = z.infer<typeof lessonLinkSchema>;
