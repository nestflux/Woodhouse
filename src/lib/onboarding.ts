export const ONBOARDING_STEPS = [
  { id: "upload", label: "Resume", path: "/onboarding/upload" },
  { id: "basics", label: "Basics", path: "/onboarding/basics" },
  { id: "headline", label: "Headline", path: "/onboarding/headline" },
  { id: "experience", label: "Experience", path: "/onboarding/experience" },
  { id: "education", label: "Education", path: "/onboarding/education" },
  { id: "skills", label: "Skills", path: "/onboarding/skills" },
  { id: "projects", label: "Projects", path: "/onboarding/projects" },
  { id: "preferences", label: "Preferences", path: "/onboarding/preferences" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export function getStepIndex(stepId: OnboardingStepId): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === stepId);
}

export function getNextStep(
  stepId: OnboardingStepId
): (typeof ONBOARDING_STEPS)[number] | null {
  const idx = getStepIndex(stepId);
  return idx < ONBOARDING_STEPS.length - 1
    ? ONBOARDING_STEPS[idx + 1]
    : null;
}

export function getPrevStep(
  stepId: OnboardingStepId
): (typeof ONBOARDING_STEPS)[number] | null {
  const idx = getStepIndex(stepId);
  return idx > 0 ? ONBOARDING_STEPS[idx - 1] : null;
}
