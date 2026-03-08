"use client";

import { usePathname } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function OnboardingProgress() {
  const pathname = usePathname();
  const currentStepId = pathname.split("/").pop();
  const currentIndex = ONBOARDING_STEPS.findIndex(
    (s) => s.id === currentStepId
  );

  return (
    <div className="border-b border-[var(--w-border)] bg-[var(--w-surface)] px-4 py-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        {ONBOARDING_STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isComplete &&
                      "bg-[var(--w-primary)] text-white",
                    isCurrent &&
                      "bg-[var(--w-primary)] text-white ring-2 ring-[var(--w-primary)] ring-offset-2",
                    !isComplete &&
                      !isCurrent &&
                      "bg-[var(--w-surface-alt)] text-[var(--w-text-muted)]"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1 hidden text-xs sm:block",
                    isCurrent
                      ? "font-medium text-[var(--w-text-primary)]"
                      : "text-[var(--w-text-muted)]"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < ONBOARDING_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px w-4 sm:mx-2 sm:w-8",
                    index < currentIndex
                      ? "bg-[var(--w-primary)]"
                      : "bg-[var(--w-border)]"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
