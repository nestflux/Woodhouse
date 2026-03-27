"use client";

import { useState, useEffect } from "react";
import { Loader2, FileDown, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportResume } from "@/lib/actions/resume-builder";

interface ExportDialogProps {
  resumeId: string;
  isPaidPlan: boolean;
  onClose: () => void;
}

export function ExportDialog({
  resumeId,
  isPaidPlan,
  onClose,
}: ExportDialogProps) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !exportingPdf && !exportingDocx) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [exportingPdf, exportingDocx, onClose]);

  async function handleExport(format: "pdf" | "docx") {
    const setExporting = format === "pdf" ? setExportingPdf : setExportingDocx;
    setExporting(true);

    try {
      const result = await exportResume(resumeId, format);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data?.url) {
        // Trigger download
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = `resume.${format}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`${format.toUpperCase()} downloaded`);
        onClose();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-lg border border-[var(--w-border)] bg-[var(--w-surface)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--w-border)] px-5 py-4">
          <h2
            id="export-dialog-title"
            className="text-lg font-semibold text-[var(--w-text-primary)]"
          >
            Export Resume
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 px-5 py-4">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => handleExport("pdf")}
            disabled={exportingPdf || exportingDocx}
          >
            {exportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            {exportingPdf ? "Generating PDF..." : "Download PDF"}
          </Button>

          {isPaidPlan ? (
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => handleExport("docx")}
              disabled={exportingPdf || exportingDocx}
            >
              {exportingDocx ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {exportingDocx ? "Generating DOCX..." : "Download DOCX"}
            </Button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-[var(--w-border)] px-3 py-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[var(--w-text-muted)]" />
                <span className="text-sm text-[var(--w-text-muted)]">
                  DOCX Export
                </span>
              </div>
              <a
                href="/settings/subscription"
                className="text-xs font-medium text-[var(--w-primary)] hover:underline"
              >
                Upgrade to Pro
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--w-border)] px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onClose}
            disabled={exportingPdf || exportingDocx}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
