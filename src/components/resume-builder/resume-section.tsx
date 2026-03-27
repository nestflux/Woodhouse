"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

export function ResumeSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: ResumeSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--w-border)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--w-text-muted)] transition-transform",
            !open && "-rotate-90"
          )}
        />
        <span className="text-sm font-semibold text-[var(--w-text-primary)]">
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
