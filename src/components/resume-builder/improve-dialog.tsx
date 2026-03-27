"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  Wand2,
  Upload,
  MessageSquare,
  FileText,
  Lock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  improveResume,
  getUserResumes,
  type UserResume,
} from "@/lib/actions/resume-builder";
import {
  fromParsedResume,
  type ResumeContent,
} from "@/lib/resume-builder/convert-to-resume-content";
import type { ResumeParsing } from "@/lib/validators/resume-parsing";

type TabId = "auto" | "reference" | "custom";

interface ImproveDialogProps {
  resumeId: string;
  isPaidPlan: boolean;
  onResult: (result: {
    improved_content: ResumeContent;
    changes: Array<{
      section: string;
      experience_index?: number | null;
      bullet_index?: number | null;
      field: string;
      original: string;
      improved: string;
    }>;
    change_summary: string;
  }) => void;
  onClose: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_CUSTOM_CHARS = 2000;

export function ImproveDialog({
  resumeId,
  isPaidPlan,
  onResult,
  onClose,
}: ImproveDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("auto");
  const [improving, setImproving] = useState(false);

  // Reference tab state
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceContent, setReferenceContent] =
    useState<ResumeContent | null>(null);
  const [parsingReference, setParsingReference] = useState(false);
  const [existingResumes, setExistingResumes] = useState<UserResume[] | null>(
    null
  );
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [loadingResumes, setLoadingResumes] = useState(false);

  // Custom tab state
  const [customPrompt, setCustomPrompt] = useState("");

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !improving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [improving, onClose]);

  // Load existing resumes for reference dropdown
  const loadExistingResumes = useCallback(async () => {
    if (existingResumes !== null) return;
    setLoadingResumes(true);
    const result = await getUserResumes();
    if (result.data) {
      setExistingResumes(
        result.data.filter((r) => r.id !== resumeId)
      );
    }
    setLoadingResumes(false);
  }, [existingResumes, resumeId]);

  // Handle reference file upload + parse
  async function handleReferenceFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PDF or DOCX file");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be 5MB or less");
      return;
    }

    setReferenceFile(file);
    setSelectedResumeId(null);
    setParsingReference(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setParsingReference(false);
        return;
      }

      // Upload to temp location
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const filePath = `${user.id}/ref_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setParsingReference(false);
        return;
      }

      // Parse the reference resume
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Session expired");
        setParsingReference(false);
        return;
      }

      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-resume`;
      const fnRes = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ file_path: filePath }),
      });

      const parseResult = await fnRes.json().catch(() => null);

      if (!fnRes.ok || !parseResult?.data) {
        toast.error("Failed to parse reference resume");
        setParsingReference(false);
        return;
      }

      const parsed = parseResult.data as ResumeParsing;
      const content = fromParsedResume(parsed, user.email ?? "");
      setReferenceContent(content);
      toast.success("Reference resume parsed");
    } catch {
      toast.error("Failed to process reference file");
    }

    setParsingReference(false);
  }

  // Select existing resume as reference
  function handleSelectExistingResume(resume: UserResume) {
    setSelectedResumeId(resume.id);
    setReferenceContent(resume.content);
    setReferenceFile(null);
  }

  // Run improvement
  async function handleImprove() {
    setImproving(true);

    const opts: {
      referenceResumeContent?: ResumeContent;
      customPrompt?: string;
    } = {};

    if (activeTab === "reference" && referenceContent) {
      opts.referenceResumeContent = referenceContent;
    }
    if (activeTab === "custom" && customPrompt.trim()) {
      opts.customPrompt = customPrompt.trim();
    }

    try {
      const result = await improveResume(resumeId, activeTab, opts);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        onResult(result.data);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setImproving(false);
    }
  }

  const canSubmit =
    activeTab === "auto" ||
    (activeTab === "reference" && referenceContent !== null) ||
    (activeTab === "custom" && customPrompt.trim().length > 0);

  const tabs: { id: TabId; label: string; icon: React.ElementType; locked: boolean }[] = [
    { id: "auto", label: "Auto-Improve", icon: Wand2, locked: false },
    { id: "reference", label: "Reference Resume", icon: Upload, locked: !isPaidPlan },
    { id: "custom", label: "Custom Prompt", icon: MessageSquare, locked: !isPaidPlan },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="improve-dialog-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-[var(--w-border)] bg-[var(--w-surface)] shadow-xl">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--w-border)] px-5 py-4">
          <h2 id="improve-dialog-title" className="text-lg font-semibold text-[var(--w-text-primary)]">
            Improve with AI
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--w-border)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.locked) return;
                setActiveTab(tab.id);
                if (tab.id === "reference") loadExistingResumes();
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "border-b-2 border-[var(--w-primary)] text-[var(--w-primary)]"
                  : tab.locked
                    ? "cursor-not-allowed text-[var(--w-text-muted)]"
                    : "text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)]"
              )}
              disabled={tab.locked}
            >
              {tab.locked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <tab.icon className="h-3.5 w-3.5" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Auto-Improve */}
          {activeTab === "auto" && (
            <div>
              <p className="mb-4 text-sm text-[var(--w-text-secondary)]">
                Automatically improve your resume based on ATS best practices.
                The AI will enhance bullet points, strengthen action verbs,
                add quantifiable metrics, and optimize formatting.
              </p>
              <p className="text-xs text-[var(--w-text-muted)]">
                This typically takes 10-30 seconds. You&apos;ll review all
                changes before they&apos;re applied.
              </p>
            </div>
          )}

          {/* Reference Resume */}
          {activeTab === "reference" && !isPaidPlan && (
            <LockedTab feature="Reference Resume" />
          )}
          {activeTab === "reference" && isPaidPlan && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--w-text-secondary)]">
                Upload a resume to use as a style and format guide. The AI
                will adopt its structure and tone without copying content.
              </p>

              {/* Upload zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleReferenceFile(file);
                }}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--w-border)] p-4"
              >
                {parsingReference ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--w-primary)]" />
                    <span className="text-xs text-[var(--w-text-muted)]">
                      Parsing reference resume...
                    </span>
                  </div>
                ) : referenceFile ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--w-primary)]" />
                    <span className="text-xs font-medium text-[var(--w-text-primary)]">
                      {referenceFile.name}
                    </span>
                    <button
                      onClick={() => {
                        setReferenceFile(null);
                        setReferenceContent(null);
                      }}
                      className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
                      aria-label="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-1 h-5 w-5 text-[var(--w-text-muted)]" />
                    <p className="text-xs text-[var(--w-text-muted)]">
                      Drop a PDF or DOCX here
                    </p>
                    <button
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".pdf,.docx";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
                          if (file) handleReferenceFile(file);
                        };
                        input.click();
                      }}
                      className="mt-1 text-xs font-medium text-[var(--w-primary)] hover:underline"
                    >
                      Browse files
                    </button>
                  </>
                )}
              </div>

              {/* Or select existing */}
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--w-text-muted)]">
                  Or select an existing resume:
                </p>
                {loadingResumes ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--w-text-muted)]" />
                    <span className="text-xs text-[var(--w-text-muted)]">
                      Loading resumes...
                    </span>
                  </div>
                ) : existingResumes && existingResumes.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {existingResumes.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectExistingResume(r)}
                        className={cn(
                          "flex items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors",
                          selectedResumeId === r.id
                            ? "bg-[var(--w-primary)]/10 text-[var(--w-primary)]"
                            : "text-[var(--w-text-secondary)] hover:bg-[var(--w-surface-alt)]"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {r.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--w-text-muted)]">
                    No other resumes available.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Custom Prompt */}
          {activeTab === "custom" && !isPaidPlan && (
            <LockedTab feature="Custom Prompt" />
          )}
          {activeTab === "custom" && isPaidPlan && (
            <div>
              <p className="mb-3 text-sm text-[var(--w-text-secondary)]">
                Tell the AI how you want to improve your resume.
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value.slice(0, MAX_CUSTOM_CHARS))}
                placeholder={"Examples:\n• Focus more on leadership experience\n• Make it suitable for a product management role\n• Condense to one page\n• Emphasize cloud and DevOps skills"}
                className="w-full resize-none rounded-md border border-[var(--w-border)] bg-[var(--w-surface)] px-3 py-2 text-sm text-[var(--w-text-primary)] placeholder:text-[var(--w-text-muted)] focus:border-[var(--w-primary)] focus:outline-none"
                rows={5}
              />
              <p className="mt-1 text-right text-xs text-[var(--w-text-muted)]">
                {customPrompt.length}/{MAX_CUSTOM_CHARS}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--w-border)] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={improving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImprove}
            disabled={improving || !canSubmit || (activeTab !== "auto" && !isPaidPlan)}
          >
            {improving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Improving...
              </>
            ) : (
              <>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                Improve Resume
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LockedTab({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Lock className="mb-2 h-8 w-8 text-[var(--w-text-muted)]" />
      <p className="mb-1 text-sm font-medium text-[var(--w-text-primary)]">
        {feature} is a Pro feature
      </p>
      <p className="mb-4 text-xs text-[var(--w-text-muted)]">
        Upgrade to Pro or Premium to use custom improvement modes.
      </p>
      <a
        href="/settings/subscription"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--w-border)] bg-[var(--w-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--w-text-secondary)] hover:bg-[var(--w-surface-alt)]"
      >
        Upgrade to Pro
      </a>
    </div>
  );
}
