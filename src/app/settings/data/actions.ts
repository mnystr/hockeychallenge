"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getT } from "@/lib/i18n/server";
import { emailTeamOrphaned } from "@/lib/email/events";

export async function requestAccountDeletion(
  _state: { message?: string } | undefined,
  formData: FormData,
): Promise<{ message?: string } | undefined> {
  const confirmation = (formData.get("confirm") ?? "").toString().trim();
  const t = await getT();
  const expected = t("settings_data.delete_confirm_word");
  // Accept both the locale-appropriate word and "DELETE" for safety if
  // the user's locale cookie shifted between form render and submit.
  if (confirmation !== expected && confirmation !== "DELETE") {
    return { message: t("settings_data.delete_confirm_error") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Snapshot the teams this user is the active admin of so we can detect
  // which ones become orphaned after the RPC runs.
  const admin = createServiceClient();
  const orphanCandidates: { id: string; name: string; slug: string }[] = [];
  if (user) {
    const { data: adminMemberships } = await admin
      .from("memberships")
      .select("teams!inner(id, name, slug, status)")
      .eq("user_id", user.id)
      .eq("role", "team_admin")
      .eq("status", "active")
      .is("deleted_at", null);
    for (const m of adminMemberships ?? []) {
      const team = (m as unknown as {
        teams: { id: string; name: string; slug: string; status: string };
      }).teams;
      if (team && team.status !== "orphaned") {
        orphanCandidates.push({ id: team.id, name: team.name, slug: team.slug });
      }
    }
  }

  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { message: error.message };

  if (orphanCandidates.length > 0) {
    const { data: postTeams } = await admin
      .from("teams")
      .select("id, name, slug, status")
      .in(
        "id",
        orphanCandidates.map((c) => c.id),
      );
    for (const team of postTeams ?? []) {
      if (team.status === "orphaned") {
        await emailTeamOrphaned({
          teamId: team.id,
          teamName: team.name,
          teamSlug: team.slug,
        });
      }
    }
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
