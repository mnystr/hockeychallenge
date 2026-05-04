"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailApprovalNeeded } from "@/lib/email/events";
import {
  inviteRedeemSchema,
  teamRequestSchema,
  type InviteRedeemFormState,
  type TeamRequestFormState,
} from "@/lib/auth/schemas";

export async function redeemInvite(
  _state: InviteRedeemFormState,
  formData: FormData,
): Promise<InviteRedeemFormState> {
  const parsed = inviteRedeemSchema.safeParse({
    code: formData.get("code"),
    displayName: formData.get("displayName"),
    jerseyNumber: formData.get("jerseyNumber"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("redeem_invite", {
    p_code: parsed.data.code,
    p_display_name: parsed.data.displayName,
    p_jersey_number: parsed.data.jerseyNumber,
    // Legacy column the schema still defines; we no longer collect it
    // from users but keep the RPC parameter explicit so PostgREST's
    // overload resolution doesn't get confused.
    p_pronouns: null,
  });

  if (error) {
    return { message: friendlyInviteError(error.message) };
  }

  // Fan out "approval needed" email to admins of the team the user just
  // applied to. The membership was just created pending, so we look it
  // up by (user, pending). Failure is swallowed inside emailApprovalNeeded.
  const { data: pendingMembership } = await supabase
    .from("memberships")
    .select("team_id, teams(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      team_id: string;
      teams: { id: string; name: string; slug: string } | null;
    }>();
  if (pendingMembership?.teams) {
    await emailApprovalNeeded({
      teamId: pendingMembership.teams.id,
      teamName: pendingMembership.teams.name,
      teamSlug: pendingMembership.teams.slug,
      kind: "membership",
    });
  }

  redirect("/onboarding/pending");
}

export async function requestTeam(
  _state: TeamRequestFormState,
  formData: FormData,
): Promise<TeamRequestFormState> {
  const parsed = teamRequestSchema.safeParse({
    requesterName: formData.get("requesterName"),
    proposedName: formData.get("proposedName"),
    requesterRole: formData.get("requesterRole"),
    requestNote: formData.get("requestNote"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("team_creation_requests").insert({
    requested_by: user.id,
    requested_by_name: parsed.data.requesterName,
    proposed_name: parsed.data.proposedName,
    requester_role: parsed.data.requesterRole,
    request_note: parsed.data.requestNote,
  });

  if (error) {
    return { message: error.message };
  }

  redirect("/onboarding/pending");
}

function friendlyInviteError(raw: string): string {
  if (raw.includes("Invalid or expired invite")) {
    return "That invite code is invalid, expired, or fully used.";
  }
  if (raw.includes("already have a membership")) {
    return "You already have a membership or application on that team.";
  }
  if (raw.includes("Not authenticated")) {
    return "Please sign in first.";
  }
  return raw;
}
