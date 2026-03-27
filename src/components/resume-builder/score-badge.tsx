import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-[#059669] border-[#059669]";
  if (score >= 60) return "text-[#d97706] border-[#d97706]";
  return "text-[#dc2626] border-[#dc2626]";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-[#059669]/10";
  if (score >= 60) return "bg-[#d97706]/10";
  return "bg-[#dc2626]/10";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-2xl",
};

export function ScoreBadge({ score, size = "md", className }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-2 border-[var(--w-border)] bg-[var(--w-surface)] font-semibold text-[var(--w-text-muted)]",
          sizeClasses[size],
          className
        )}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-2 font-bold",
        getScoreColor(score),
        getScoreBg(score),
        sizeClasses[size],
        className
      )}
    >
      {score}
    </div>
  );
}
