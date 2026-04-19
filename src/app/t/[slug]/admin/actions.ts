"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";

export async function approveMembership(slug: string, membershipId: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_membership", {
    p_membership_id: membershipId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/approvals`);
}

export async function rejectMembership(
  slug: string,
  membershipId: string,
  note: string | null,
) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_membership", {
    p_membership_id: membershipId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/approvals`);
}

const createInviteSchema = z.object({
  code: z.string().trim().max(40).optional().transform((v) => v || null),
  expiresInDays: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 365), {
      error: "Must be 1–365.",
    }),
  maxUses: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 1000), {
      error: "Must be 1–1000.",
    }),
});

export type CreateInviteFormState =
  | {
      errors?: {
        code?: string[];
        expiresInDays?: string[];
        maxUses?: string[];
      };
      message?: string;
    }
  | undefined;

export async function createInvite(
  slug: string,
  _state: CreateInviteFormState,
  formData: FormData,
): Promise<CreateInviteFormState> {
  const parsed = createInviteSchema.safeParse({
    code: formData.get("code"),
    expiresInDays: formData.get("expiresInDays"),
    maxUses: formData.get("maxUses"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { teamId } = await requireTeamAdmin(slug);
  const supabase = await createClient();

  const expiresAt =
    parsed.data.expiresInDays === null
      ? null
      : new Date(
          Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString();

  const { error } = await supabase.rpc("create_invite", {
    p_team_id: teamId,
    p_code: parsed.data.code,
    p_expires_at: expiresAt,
    p_max_uses: parsed.data.maxUses,
  });

  if (error) {
    return { message: error.message };
  }

  revalidatePath(`/t/${slug}/admin/invites`);
  return { message: "Invite created." };
}

export async function revokeInvite(slug: string, inviteId: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/invites`);
}

export async function approveProfileChange(slug: string, requestId: string) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_profile_change", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/approvals`);
}

export async function rejectProfileChange(
  slug: string,
  requestId: string,
  note: string | null,
) {
  await requireTeamAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_profile_change", {
    p_request_id: requestId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/t/${slug}/admin/approvals`);
}
