import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth/session";
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

  return <OnboardingForms email={session.email} />;
}
