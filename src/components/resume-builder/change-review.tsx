"use client";

import { useState, useEffect } from "react";
import { Check, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/lib/resume-builder/convert-to-resume-content";

interface Change {
  section: string;
  experience_index?: number | null;
  bullet_index?: number | null;
  field: string;
  original: string;
  improved: string;
}

interface ChangeReviewProps {
  changeSummary: string;
  changes: Change[];
  improvedContent: ResumeContent;
  onAcceptAll: (content: ResumeContent) => void;
  onAcceptSelected: (
    selectedChanges: Change[],
    improvedContent: ResumeContent
  ) => void;
  onRejectAll: () => void;
}

export function ChangeReview({
  changeSummary,
  changes,
  improvedContent,
  onAcceptAll,
  onAcceptSelected,
  onRejectAll,
}: ChangeReviewProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(changes.map((_, i) => i))
  );

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onRejectAll();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onRejectAll]);

  function toggleChange(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === changes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(changes.map((_, i) => i)));
    }
  }

  function handleAcceptSelected() {
    const selectedChanges = changes.filter((_, i) => selected.has(i));
    onAcceptSelected(selectedChanges, improvedContent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="change-review-title">
      <div className="absolute inset-0 bg-black/50" onClick={onRejectAll} />
      <div className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--w-border)] bg-[var(--w-surface)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--w-border)] px-5 py-4">
          <div>
            <h2 id="change-review-title" className="text-lg font-semibold text-[var(--w-text-primary)]">
              Review Changes
            </h2>
            <p className="mt-0.5 text-xs text-[var(--w-text-muted)]">
              {changeSummary}
            </p>
          </div>
          <button
            onClick={onRejectAll}
            className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Select all header */}
        <div className="flex items-center justify-between border-b border-[var(--w-border)] px-5 py-2">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs font-medium text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)]"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                selected.size === changes.length
                  ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-white"
                  : "border-[var(--w-border)]"
              )}
            >
              {selected.size === changes.length && (
                <Check className="h-3 w-3" />
              )}
            </span>
            Select all ({selected.size}/{changes.length})
          </button>
        </div>

        {/* Changes list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {changes.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--w-text-muted)]">
              No changes were suggested.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {changes.map((change, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-md border p-3 transition-colors",
                    selected.has(i)
                      ? "border-[var(--w-primary)]/30 bg-[var(--w-primary)]/5"
                      : "border-[var(--w-border)]"
                  )}
                >
                  <div className="mb-2 flex items-start gap-2">
                    <button
                      onClick={() => toggleChange(i)}
                      className="mt-0.5 shrink-0"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          selected.has(i)
                            ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-white"
                            : "border-[var(--w-border)]"
                        )}
                      >
                        {selected.has(i) && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-[var(--w-text-muted)]">
                        {formatChangeLabel(change)}
                      </span>
                    </div>
                  </div>

                  {/* Diff view */}
                  <div className="ml-6 space-y-1.5">
                    <div className="rounded bg-[#dc2626]/5 px-2 py-1">
                      <p className="text-xs text-[#dc2626] line-through">
                        {change.original}
                      </p>
                    </div>
                    <div className="rounded bg-[#059669]/5 px-2 py-1">
                      <p className="text-xs text-[#059669]">
                        {change.improved}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--w-border)] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onRejectAll}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Reject All
          </Button>
          <div className="flex items-center gap-2">
            {selected.size > 0 && selected.size < changes.length && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcceptSelected}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Accept Selected ({selected.size})
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => onAcceptAll(improvedContent)}
              disabled={changes.length === 0}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatChangeLabel(change: Change): string {
  const section = change.section
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (
    change.section === "work_experience" &&
    change.experience_index !== null &&
    change.experience_index !== undefined
  ) {
    const bulletLabel =
      change.bullet_index !== null && change.bullet_index !== undefined
        ? ` · Bullet ${change.bullet_index + 1}`
        : "";
    return `${section} #${change.experience_index + 1}${bulletLabel}`;
  }

  if (change.field) {
    const field = change.field
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${section} · ${field}`;
  }

  return section;
}
