"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--w-background)] px-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-12 w-12 text-[var(--w-error)] mx-auto" />
        <h2 className="text-xl font-bold text-[var(--w-text-primary)]">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--w-text-secondary)] leading-relaxed">
          An error occurred during onboarding. Your progress has been saved — please
          try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} size="sm">
            Try Again
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
