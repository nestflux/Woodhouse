"use client";

import { ScoreBadge } from "./score-badge";
import { DimensionChart } from "./dimension-chart";
import { SuggestionList } from "./suggestion-list";
import type { ScoringBreakdown } from "@/lib/actions/resume-builder";

interface ScorePanelProps {
  overallScore: number | null;
  breakdown: ScoringBreakdown | null;
  appliedIndices: Set<number>;
  onApplySuggestion: (index: number) => void;
  onApplyAll: () => void;
  applyingIndex: number | null;
  applyingAll: boolean;
  workExperiences?: Array<{ company_name: string }>;
}

export function ScorePanel({
  overallScore,
  breakdown,
  appliedIndices,
  onApplySuggestion,
  onApplyAll,
  applyingIndex,
  applyingAll,
  workExperiences,
}: ScorePanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Overall Score */}
      <div className="flex flex-col items-center gap-2">
        <ScoreBadge score={overallScore} size="lg" />
        <span className="text-sm font-medium text-[var(--w-text-secondary)]">
          {overallScore !== null ? "Overall Score" : "Not Scored"}
        </span>
      </div>

      {/* Dimension Breakdown */}
      {breakdown?.dimensions && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--w-text-primary)]">
            Score Breakdown
          </h3>
          <DimensionChart dimensions={breakdown.dimensions} />
        </div>
      )}

      {/* General Feedback */}
      {breakdown?.general_feedback && breakdown.general_feedback.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--w-text-primary)]">
            General Feedback
          </h3>
          <ul className="flex flex-col gap-1.5">
            {breakdown.general_feedback.map((item, i) => (
              <li
                key={i}
                className="text-xs leading-relaxed text-[var(--w-text-secondary)]"
              >
                &bull; {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--w-text-primary)]">
          Suggestions
          {breakdown?.suggestions && breakdown.suggestions.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-[var(--w-text-muted)]">
              ({breakdown.suggestions.length})
            </span>
          )}
        </h3>
        <SuggestionList
          suggestions={breakdown?.suggestions ?? []}
          appliedIndices={appliedIndices}
          onApply={onApplySuggestion}
          onApplyAll={onApplyAll}
          applyingIndex={applyingIndex}
          applyingAll={applyingAll}
          workExperiences={workExperiences}
        />
      </div>
    </div>
  );
}
