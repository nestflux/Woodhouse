"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Star, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./score-badge";
import {
  deleteUserResume,
  setActiveResume,
} from "@/lib/actions/resume-builder";
import { toast } from "sonner";

interface ResumeCardProps {
  id: string;
  name: string;
  overallScore: number | null;
  status: string;
  isActive: boolean;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scored":
      return "Scored";
    case "error":
      return "Error";
    case "uploading":
      return "Uploading";
    case "parsing":
      return "Parsing";
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "scored":
      return "bg-[#059669]/10 text-[#059669]";
    case "error":
      return "bg-[#dc2626]/10 text-[#dc2626]";
    case "draft":
      return "bg-[var(--w-surface)] text-[var(--w-text-muted)]";
    default:
      return "bg-[var(--w-surface)] text-[var(--w-text-secondary)]";
  }
}

export function ResumeCard({
  id,
  name,
  overallScore,
  status,
  isActive,
  updatedAt,
}: ResumeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteUserResume(id);
    if (result.error) {
      toast.error(result.error);
      setDeleting(false);
    } else {
      toast.success("Resume deleted");
    }
  }

  async function handleSetActive() {
    const result = await setActiveResume(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Set as active resume");
    }
    setMenuOpen(false);
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4 transition-shadow hover:shadow-md",
        isActive && "ring-2 ring-[var(--w-primary)]"
      )}
    >
      {/* Top row: score + badges */}
      <div className="mb-3 flex items-start justify-between">
        <ScoreBadge score={overallScore} size="md" />
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="rounded-full bg-[var(--w-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--w-primary)]">
              Active
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              getStatusColor(status)
            )}
          >
            {getStatusLabel(status)}
          </span>
        </div>
      </div>

      {/* Name */}
      <Link
        href={`/resume/${id}`}
        className="mb-1 text-sm font-semibold text-[var(--w-text-primary)] hover:text-[var(--w-primary)]"
      >
        {name}
      </Link>

      {/* Date */}
      <p className="mb-3 text-xs text-[var(--w-text-muted)]">
        Updated {formatDate(updatedAt)}
      </p>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between">
        <Link
          href={`/resume/${id}`}
          className="text-xs font-medium text-[var(--w-primary)] hover:underline"
        >
          Open
        </Link>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-[var(--w-border)] bg-[var(--w-surface)] py-1 shadow-lg">
                {!isActive && (
                  <button
                    onClick={handleSetActive}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--w-text-secondary)] hover:bg-[var(--w-surface-alt)]"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Set as Active
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#dc2626] hover:bg-[#dc2626]/5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
