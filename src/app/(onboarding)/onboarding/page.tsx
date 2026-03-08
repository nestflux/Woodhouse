import { redirect } from "next/navigation";
import { getResumeStep } from "@/lib/actions/onboarding";

export default async function OnboardingIndexPage() {
  const step = await getResumeStep();
  redirect(step);
}
