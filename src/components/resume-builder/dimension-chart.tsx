"use client";

import { cn } from "@/lib/utils";

interface Dimension {
  key: string;
  label: string;
  score: number;
  max: number;
  feedback: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  ats_compatibility: "ATS Compatibility",
  content_quality: "Content Quality",
  impact_metrics: "Impact & Metrics",
  brevity_clarity: "Brevity & Clarity",
  keyword_optimization: "Keyword Optimization",
  section_completeness: "Section Completeness",
};

function getBarColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return "bg-[#059669]";
  if (pct >= 60) return "bg-[#d97706]";
  return "bg-[#dc2626]";
}

function getTextColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return "text-[#059669]";
  if (pct >= 60) return "text-[#d97706]";
  return "text-[#dc2626]";
}

interface DimensionChartProps {
  dimensions: Record<string, { score: number; max: number; feedback: string }>;
}

export function DimensionChart({ dimensions }: DimensionChartProps) {
  const items: Dimension[] = Object.entries(dimensions).map(([key, val]) => ({
    key,
    label: DIMENSION_LABELS[key] ?? key.replace(/_/g, " "),
    score: val.score,
    max: val.max,
    feedback: val.feedback,
  }));

  return (
    <div className="flex flex-col gap-3">
      {items.map((dim) => {
        const pct = dim.max > 0 ? (dim.score / dim.max) * 100 : 0;
        return (
          <div key={dim.key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--w-text-secondary)]">
                {dim.label}
              </span>
              <span
                className={cn("text-xs font-bold", getTextColor(dim.score, dim.max))}
              >
                {dim.score}/{dim.max}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--w-surface-alt)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  getBarColor(dim.score, dim.max)
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--w-text-muted)]">
              {dim.feedback}
            </p>
          </div>
        );
      })}
    </div>
  );
}
