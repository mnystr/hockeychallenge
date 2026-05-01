import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export type AuthFormState =
  | {
      errors?: { email?: string[]; password?: string[] };
      message?: string;
    }
  | undefined;

export const inviteRedeemSchema = z.object({
  code: z.string().min(1, { error: "Enter an invite code." }).trim(),
  displayName: z
    .string()
    .min(1, { error: "Enter the player's display name." })
    .max(60)
    .trim(),
  jerseyNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 999), {
      error: "Jersey number must be 0–999.",
    }),
});

export type InviteRedeemFormState =
  | {
      errors?: {
        code?: string[];
        displayName?: string[];
        jerseyNumber?: string[];
      };
      message?: string;
    }
  | undefined;

export const teamRequestSchema = z.object({
  proposedName: z
    .string()
    .min(2, { error: "Team name must be at least 2 characters." })
    .max(80)
    .trim(),
});

export type TeamRequestFormState =
  | { errors?: { proposedName?: string[] }; message?: string }
  | undefined;
