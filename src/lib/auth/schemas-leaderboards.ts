import { z } from "zod";
import { CHALLENGE_CARD_THEMES } from "@/lib/challenges/card-themes";

const optionalTimestamp = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  });

export const leaderboardSchema = z
  .object({
    name: z.string().min(1, { error: "Name required." }).max(120).trim(),
    description: z.string().max(2000).default(""),
    kind: z.enum(["points", "standalone"]),
    sort_order: z.enum(["desc", "asc"]),
    unit: z.string().trim().max(30).optional().transform((v) => v || null),
    starts_at: optionalTimestamp,
    ends_at: optionalTimestamp,
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
      v.starts_at === null ||
      v.ends_at === null ||
      new Date(v.ends_at) > new Date(v.starts_at),
    { message: "Ends at must be after starts at.", path: ["ends_at"] },
  );

export type LeaderboardInput = z.infer<typeof leaderboardSchema>;
export type LeaderboardFormState =
  | {
      errors?: Partial<Record<keyof LeaderboardInput, string[]>>;
      message?: string;
    }
  | undefined;

export const standaloneEntrySchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, { error: "Enter a number." })
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), { error: "Must be a number." }),
});

export type StandaloneEntryFormState =
  | { errors?: { value?: string[] }; message?: string }
  | undefined;
