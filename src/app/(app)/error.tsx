"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-12 w-12 text-[var(--w-error)] mx-auto" />
        <h2 className="text-xl font-bold text-[var(--w-text-primary)]">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--w-text-secondary)] leading-relaxed">
          An unexpected error occurred. Please try again, or contact support if the
          problem persists.
        </p>
        <Button onClick={reset} size="sm">
          Try Again
        </Button>
      </div>
    </div>
  );
}
