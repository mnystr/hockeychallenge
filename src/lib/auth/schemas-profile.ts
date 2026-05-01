import { z } from "zod";

export const profileChangeSchema = z.object({
  display_name: z.string().trim().max(60).default(""),
  jersey_number: z
    .string()
    .trim()
    .default("")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 999), {
      error: "Jersey number must be 0–999.",
    }),
  visibility: z.enum(["full", "first_name_only", "initials"]),
});

export type ProfileChangeInput = z.infer<typeof profileChangeSchema>;

export type ProfileChangeFormState =
  | {
      errors?: Partial<Record<keyof ProfileChangeInput, string[]>>;
      message?: string;
    }
  | undefined;
