import { OnboardingProgress } from "@/components/onboarding-progress";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OnboardingProgress />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        {children}
      </div>
    </>
  );
}
