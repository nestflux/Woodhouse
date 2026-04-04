"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { highlightPlaceholders } from "@/lib/resume-builder/highlight-placeholders";
import type { Suggestion } from "@/lib/actions/resume-builder";

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#dc2626]/10 text-[#dc2626]",
  medium: "bg-[#d97706]/10 text-[#d97706]",
  low: "bg-[var(--w-surface)] text-[var(--w-text-muted)]",
};

interface SuggestionListProps {
  suggestions: Suggestion[];
  appliedIndices: Set<number>;
  onApply: (index: number) => void;
  onApplyAll: () => void;
  applyingIndex: number | null;
  applyingAll: boolean;
  workExperiences?: Array<{ company_name: string }>;
}

export function SuggestionList({
  suggestions,
  appliedIndices,
  onApply,
  onApplyAll,
  applyingIndex,
  applyingAll,
  workExperiences,
}: SuggestionListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const sorted = suggestions
    .map((s, i) => ({ ...s, originalIndex: i }))
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    );

  const unappliedCount = suggestions.filter(
    (_, i) => !appliedIndices.has(i)
  ).length;

  if (suggestions.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-[var(--w-text-muted)]">
        <Sparkles className="mx-auto mb-2 h-5 w-5" />
        No suggestions yet. Score your resume to get AI-powered improvement
        suggestions.
      </div>
    );
  }

  return (
    <div>
      {unappliedCount > 1 && (
        <Button
          size="sm"
          variant="outline"
          className="mb-3 w-full"
          onClick={onApplyAll}
          disabled={applyingAll || unappliedCount === 0}
        >
          {applyingAll ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Applying all...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-3.5 w-3.5" />
              Apply All ({unappliedCount})
            </>
          )}
        </Button>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map((suggestion) => {
          const isApplied = appliedIndices.has(suggestion.originalIndex);
          const isApplying = applyingIndex === suggestion.originalIndex;
          const isExpanded = expandedIndex === suggestion.originalIndex;

          return (
            <div
              key={suggestion.originalIndex}
              className={cn(
                "rounded-md border border-[var(--w-border)] p-3 transition-colors",
                isApplied && "border-[#059669]/30 bg-[#059669]/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        PRIORITY_STYLES[suggestion.priority]
                      )}
                    >
                      {suggestion.priority}
                    </span>
                    <span className="text-xs text-[var(--w-text-muted)]">
                      {formatSection(
                        suggestion.section,
                        suggestion.experience_index,
                        workExperiences
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--w-text-secondary)]">
                    {suggestion.reason}
                  </p>
                </div>
                {isApplied ? (
                  <span className="flex h-7 items-center gap-1 text-xs font-medium text-[#059669]">
                    <Check className="h-3.5 w-3.5" />
                    Applied
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => onApply(suggestion.originalIndex)}
                    disabled={isApplying}
                  >
                    {isApplying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                )}
              </div>

              <button
                onClick={() =>
                  setExpandedIndex(
                    isExpanded ? null : suggestion.originalIndex
                  )
                }
                className="mt-2 text-xs font-medium text-[var(--w-primary)] hover:underline"
              >
                {isExpanded ? "Hide diff" : "Show diff"}
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-1.5 rounded bg-[var(--w-surface-alt)] p-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-[var(--w-text-muted)]">
                      Original
                    </span>
                    <p className="text-xs text-[#dc2626] line-through">
                      {suggestion.original}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-[var(--w-text-muted)]">
                      Suggested
                    </span>
                    <p className="text-xs text-[#059669]">
                      {highlightPlaceholders(suggestion.suggested)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSection(
  section: string,
  experienceIndex: number | null,
  workExperiences?: Array<{ company_name: string }>
): string {
  if (experienceIndex !== null && section === "work_experience") {
    const company = workExperiences?.[experienceIndex]?.company_name;
    if (company) return `Work Experience · ${company}`;
    return `Work Experience #${experienceIndex + 1}`;
  }
  return section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
