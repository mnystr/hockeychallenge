import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import OnboardingForms from "./forms";

export default async function OnboardingPage() {
  const session = await getSessionState();

  if (session.kind === "anonymous") redirect("/login");
  if (session.kind === "has_memberships") {
    redirect(`/t/${session.defaultTeamSlug}`);
  }
  if (session.hasPendingMembership || session.hasPendingTeamRequest) {
    redirect("/onboarding/pending");
  }

  const t = await getT();

  return (
    <OnboardingForms
      email={session.email}
      isSuperAdmin={session.isSuperAdmin}
      strings={{
        welcome: t("onboarding.welcome"),
        intro: t("onboarding.intro"),
        tab_join: t("onboarding.tab_join"),
        tab_request: t("onboarding.tab_request"),
        invite_code: t("onboarding.invite_code"),
        invite_code_ph: t("onboarding.invite_code_ph"),
        display_name: t("onboarding.display_name"),
        display_name_ph: t("onboarding.display_name_ph"),
        display_name_hint: t("onboarding.display_name_hint"),
        jersey_number: t("onboarding.jersey_number"),
        apply_join: t("onboarding.apply_join"),
        apply_join_pending: t("onboarding.apply_join_pending"),
        team_name: t("onboarding.team_name"),
        team_name_ph: t("onboarding.team_name_ph"),
        team_name_hint: t("onboarding.team_name_hint"),
        requester_role: t("onboarding.requester_role"),
        requester_role_hint: t("onboarding.requester_role_hint"),
        requester_role_placeholder: t("onboarding.requester_role_placeholder"),
        requester_role_coach: t("onboarding.requester_role_coach"),
        requester_role_team_leader: t("onboarding.requester_role_team_leader"),
        requester_role_parent: t("onboarding.requester_role_parent"),
        requester_role_player: t("onboarding.requester_role_player"),
        requester_role_other: t("onboarding.requester_role_other"),
        request_note: t("onboarding.request_note"),
        request_note_ph: t("onboarding.request_note_ph"),
        request_note_hint: t("onboarding.request_note_hint"),
        submit_request: t("onboarding.submit_request"),
        submit_request_pending: t("onboarding.submit_request_pending"),
        sign_out: t("common.sign_out"),
        superadmin_banner_title: t("onboarding.superadmin_banner_title"),
        superadmin_banner_body: t("onboarding.superadmin_banner_body"),
        superadmin_link: t("onboarding.superadmin_link"),
      }}
    />
  );
}
