import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getOnboardingState } from "@/server/onboarding";

import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await requireUser();

  // The wizard runs once. Anyone who has already been through it is done here —
  // completeOnboarding would refuse them anyway.
  if (!user.needsOnboarding) redirect("/dashboard");

  const state = await getOnboardingState(user);

  return <OnboardingWizard state={state} menteeGroupId={user.menteeGroupId} />;
}
