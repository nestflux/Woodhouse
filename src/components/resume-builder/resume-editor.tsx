"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Star,
  StarOff,
  ArrowLeft,
  Wand2,
  Download,
  UserCheck,
  BarChart3,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ResumeSection } from "./resume-section";
import { BulletSuggestion } from "./bullet-suggestion";
import { ScorePanel } from "./score-panel";
import { ImproveDialog } from "./improve-dialog";
import { ChangeReview } from "./change-review";
import { ExportDialog } from "./export-dialog";
import {
  updateUserResume,
  scoreResume,
  setActiveResume,
  applyBulletSuggestion,
  applySummarySuggestion,
  applyAllSuggestions,
  syncResumeToProfile,
  type UserResume,
  type ScoringBreakdown,
  type Suggestion,
} from "@/lib/actions/resume-builder";
import type { ResumeContent } from "@/lib/resume-builder/convert-to-resume-content";

interface ImproveResult {
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
}

interface ResumeEditorProps {
  resume: UserResume;
  isPaidPlan: boolean;
}

export function ResumeEditor({ resume: initial, isPaidPlan: initialIsPaidPlan }: ResumeEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<ResumeContent>(initial.content);
  const [name, setName] = useState(initial.name);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [overallScore, setOverallScore] = useState(initial.overall_score);
  const [breakdown, setBreakdown] = useState<ScoringBreakdown | null>(
    initial.scoring_breakdown
  );
  const [status, setStatus] = useState(initial.status);
  const [isPaidPlan, setIsPaidPlan] = useState(initialIsPaidPlan);

  // Client-side subscription check fallback
  useEffect(() => {
    async function checkPlan() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("profile_id", user.id)
          .single();
        if (data && data.plan !== "free") {
          setIsPaidPlan(true);
        }
      } catch {
        // Ignore — keep server-side value
      }
    }
    if (!initialIsPaidPlan) checkPlan();
  }, [initialIsPaidPlan]);

  // UI state
  const [scoring, setScoring] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(initial.name);
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingContent, setSavingContent] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Auto-save content changes with debounce
  const saveContent = useCallback(
    (updatedContent: ResumeContent) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSavingContent(true);
        const result = await updateUserResume(initial.id, {
          content: updatedContent,
        });
        setSavingContent(false);
        if (result.error) {
          toast.error("Failed to save changes");
        }
      }, 1000);
    },
    [initial.id]
  );

  // Update content and trigger auto-save
  function updateContent(updated: ResumeContent) {
    setContent(updated);
    saveContent(updated);
  }

  // ── Name editing ──
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  async function handleNameSave() {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === name) {
      setNameValue(name);
      return;
    }
    setName(trimmed);
    const result = await updateUserResume(initial.id, { name: trimmed });
    if (result.error) {
      toast.error("Failed to update name");
      setName(initial.name);
      setNameValue(initial.name);
    }
  }

  // ── Scoring ──
  async function handleScore() {
    setScoring(true);
    const result = await scoreResume(initial.id);
    setScoring(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data) {
      setOverallScore(result.data.overall_score);
      setBreakdown(result.data.scoring_breakdown);
      setStatus("scored");
      setAppliedIndices(new Set());
      toast.success(`Score: ${result.data.overall_score}/100`);
    }
  }

  // ── Set Active ──
  async function handleToggleActive() {
    if (isActive) return; // Can't deactivate directly
    const result = await setActiveResume(initial.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setIsActive(true);
      toast.success("Set as active resume");
    }
  }

  // ── Apply single suggestion ──
  async function handleApplySuggestion(index: number) {
    if (!breakdown?.suggestions) return;
    const suggestion = breakdown.suggestions[index];
    if (!suggestion) return;

    setApplyingIndex(index);

    if (
      suggestion.section === "summary" &&
      suggestion.suggested
    ) {
      const result = await applySummarySuggestion(
        initial.id,
        suggestion.suggested
      );
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setContent(result.data);
        setAppliedIndices((prev) => new Set([...prev, index]));
      }
    } else if (
      suggestion.section === "work_experience" &&
      suggestion.experience_index !== null &&
      suggestion.bullet_index !== null
    ) {
      const result = await applyBulletSuggestion(
        initial.id,
        {
          experienceIndex: suggestion.experience_index,
          bulletIndex: suggestion.bullet_index,
        },
        suggestion.suggested
      );
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setContent(result.data);
        setAppliedIndices((prev) => new Set([...prev, index]));
      }
    } else {
      // For other sections, apply via content update
      const updated = applyGenericSuggestion(content, suggestion);
      if (updated) {
        const result = await updateUserResume(initial.id, {
          content: updated,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          setContent(updated);
          setAppliedIndices((prev) => new Set([...prev, index]));
        }
      }
    }

    setApplyingIndex(null);
  }

  // ── Apply all suggestions ──
  async function handleApplyAll() {
    if (!breakdown?.suggestions) return;
    setApplyingAll(true);

    let currentContent = structuredClone(content);
    const newApplied = new Set(appliedIndices);

    for (let i = 0; i < breakdown.suggestions.length; i++) {
      if (newApplied.has(i)) continue;
      const suggestion = breakdown.suggestions[i];

      if (
        suggestion.section === "work_experience" &&
        suggestion.experience_index !== null &&
        suggestion.bullet_index !== null
      ) {
        const exp =
          currentContent.work_experience[suggestion.experience_index];
        if (exp?.achievements[suggestion.bullet_index]) {
          exp.achievements[suggestion.bullet_index].text =
            suggestion.suggested;
          newApplied.add(i);
        }
      } else if (suggestion.section === "summary") {
        currentContent.summary = suggestion.suggested;
        newApplied.add(i);
      } else {
        const updated = applyGenericSuggestion(currentContent, suggestion);
        if (updated) {
          currentContent = updated;
          newApplied.add(i);
        }
      }
    }

    const result = await applyAllSuggestions(initial.id, currentContent);
    setApplyingAll(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setContent(currentContent);
      setAppliedIndices(newApplied);
      toast.success("All suggestions applied");
    }
  }

  // ── Improve flow handlers ──
  function handleImproveResult(result: ImproveResult) {
    setShowImproveDialog(false);
    setImproveResult(result);
  }

  async function handleAcceptAllChanges(improvedContent: ResumeContent) {
    const result = await applyAllSuggestions(initial.id, improvedContent);
    if (result.error) {
      toast.error(result.error);
    } else {
      setContent(improvedContent);
      toast.success("All changes accepted");
    }
    setImproveResult(null);
  }

  async function handleAcceptSelectedChanges(
    selectedChanges: ImproveResult["changes"],
    improvedContent: ResumeContent
  ) {
    // Apply only selected changes to current content
    const updated = structuredClone(content);

    for (const change of selectedChanges) {
      if (
        change.section === "work_experience" &&
        change.experience_index !== null &&
        change.experience_index !== undefined &&
        change.bullet_index !== null &&
        change.bullet_index !== undefined
      ) {
        const exp = updated.work_experience[change.experience_index];
        if (exp?.achievements[change.bullet_index]) {
          exp.achievements[change.bullet_index].text = change.improved;
        }
      } else if (change.section === "summary") {
        updated.summary = change.improved;
      } else if (change.section === "skills") {
        const idx = updated.skills.indexOf(change.original);
        if (idx !== -1) {
          updated.skills[idx] = change.improved;
        }
      } else if (change.section === "header") {
        const header = updated.header as unknown as Record<
          string,
          string | null | undefined
        >;
        for (const key of Object.keys(header)) {
          if (header[key] === change.original) {
            header[key] = change.improved;
            break;
          }
        }
      }
    }

    const result = await applyAllSuggestions(initial.id, updated);
    if (result.error) {
      toast.error(result.error);
    } else {
      setContent(updated);
      toast.success(`${selectedChanges.length} changes accepted`);
    }
    setImproveResult(null);
  }

  // ── Profile sync ──
  async function handleSyncToProfile() {
    if (
      !confirm(
        "This will replace your current profile data (work experience, education, skills, projects, certifications) with the content of this resume. This cannot be undone."
      )
    )
      return;

    setSyncing(true);
    try {
      const result = await syncResumeToProfile(initial.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated with resume data");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  // ── Inline content editing helpers ──
  function handleBulletTextChange(
    expIndex: number,
    bulletIndex: number,
    newText: string
  ) {
    const updated = structuredClone(content);
    const exp = updated.work_experience[expIndex];
    if (exp?.achievements[bulletIndex]) {
      exp.achievements[bulletIndex].text = newText;
      updateContent(updated);
    }
  }

  function handleSummaryChange(newSummary: string) {
    const updated = { ...content, summary: newSummary };
    updateContent(updated);
  }

  function handleSkillAdd(skill: string) {
    if (content.skills.includes(skill)) return;
    const updated = { ...content, skills: [...content.skills, skill] };
    updateContent(updated);
  }

  function handleSkillRemove(index: number) {
    const updated = {
      ...content,
      skills: content.skills.filter((_, i) => i !== index),
    };
    updateContent(updated);
  }

  // ── Find suggestion for a bullet ──
  function findSuggestion(
    expIndex: number,
    bulletIndex: number
  ): { suggestion: Suggestion; index: number } | null {
    if (!breakdown?.suggestions) return null;
    for (let i = 0; i < breakdown.suggestions.length; i++) {
      const s = breakdown.suggestions[i];
      if (
        s.section === "work_experience" &&
        s.experience_index === expIndex &&
        s.bullet_index === bulletIndex
      ) {
        return { suggestion: s, index: i };
      }
    }
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--w-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/resume"
            className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") {
                    setNameValue(name);
                    setEditingName(false);
                  }
                }}
                className="rounded border border-[var(--w-primary)] bg-[var(--w-surface)] px-2 py-1 text-lg font-bold text-[var(--w-text-primary)] outline-none"
              />
              <button
                onClick={handleNameSave}
                className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setNameValue(name);
                  setEditingName(false);
                }}
                className="text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-2"
            >
              <h1 className="text-lg font-bold text-[var(--w-text-primary)]">
                {name}
              </h1>
              <Pencil className="h-3.5 w-3.5 text-[var(--w-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          {savingContent && (
            <span className="text-xs text-[var(--w-text-muted)]">
              Saving...
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={isActive ? "default" : "outline"}
            onClick={handleToggleActive}
            disabled={isActive}
          >
            {isActive ? (
              <>
                <Star className="mr-1.5 h-3.5 w-3.5" />
                Active
              </>
            ) : (
              <>
                <StarOff className="mr-1.5 h-3.5 w-3.5" />
                Set Active
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleScore}
            disabled={scoring}
          >
            {scoring ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Scoring...
              </>
            ) : (
              <>
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                {status === "scored" ? "Rescore" : "Score Resume"}
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowImproveDialog(true)}
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Improve with AI
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncToProfile}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Use as Profile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left panel — Resume Content */}
        <div className="flex-1 overflow-y-auto border-b border-[var(--w-border)] lg:border-r lg:border-b-0">
          {/* Header Section */}
          <ResumeSection title="Contact Information">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Full Name" value={content.header.full_name} />
              <Field label="Headline" value={content.header.headline} />
              <Field label="Email" value={content.header.email} />
              <Field label="Phone" value={content.header.phone ?? ""} />
              <Field label="Location" value={content.header.location ?? ""} />
              <Field
                label="LinkedIn"
                value={content.header.linkedin_url ?? ""}
              />
              <Field
                label="Portfolio"
                value={content.header.portfolio_url ?? ""}
              />
            </div>
          </ResumeSection>

          {/* Summary Section */}
          <ResumeSection title="Summary">
            <EditableText
              value={content.summary}
              onChange={handleSummaryChange}
              placeholder="Write a professional summary..."
            />
          </ResumeSection>

          {/* Work Experience */}
          <ResumeSection
            title="Work Experience"
            badge={
              content.work_experience.length > 0 ? (
                <span className="text-xs text-[var(--w-text-muted)]">
                  ({content.work_experience.length})
                </span>
              ) : undefined
            }
          >
            {content.work_experience.length === 0 ? (
              <p className="text-xs text-[var(--w-text-muted)]">
                No work experience entries.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {content.work_experience.map((exp, expIndex) => (
                  <div
                    key={exp.source_id}
                    className="rounded-md border border-[var(--w-border)] p-3"
                  >
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-[var(--w-text-primary)]">
                        {exp.job_title}
                      </p>
                      <p className="text-xs text-[var(--w-text-secondary)]">
                        {exp.company_name}
                        {exp.location ? ` · ${exp.location}` : ""}
                      </p>
                      <p className="text-xs text-[var(--w-text-muted)]">
                        {exp.start_date}
                        {exp.end_date ? ` – ${exp.end_date}` : ""}
                      </p>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {exp.achievements.map((ach, bulletIndex) => {
                        const match = findSuggestion(expIndex, bulletIndex);
                        return (
                          <BulletSuggestion
                            key={ach.source_id}
                            text={ach.text}
                            suggestion={match?.suggestion}
                            isApplied={
                              match ? appliedIndices.has(match.index) : false
                            }
                            onTextChange={(newText) =>
                              handleBulletTextChange(
                                expIndex,
                                bulletIndex,
                                newText
                              )
                            }
                          />
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </ResumeSection>

          {/* Skills */}
          <ResumeSection title="Skills">
            <SkillTags
              skills={content.skills}
              onAdd={handleSkillAdd}
              onRemove={handleSkillRemove}
            />
          </ResumeSection>

          {/* Education */}
          <ResumeSection title="Education">
            {content.education.length === 0 ? (
              <p className="text-xs text-[var(--w-text-muted)]">
                No education entries.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {content.education.map((edu) => (
                  <div key={edu.source_id}>
                    <p className="text-sm font-medium text-[var(--w-text-primary)]">
                      {edu.degree}
                      {edu.field_of_study ? ` in ${edu.field_of_study}` : ""}
                    </p>
                    <p className="text-xs text-[var(--w-text-secondary)]">
                      {edu.institution}
                    </p>
                    {edu.dates && (
                      <p className="text-xs text-[var(--w-text-muted)]">
                        {edu.dates}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ResumeSection>

          {/* Projects */}
          {content.projects && content.projects.length > 0 && (
            <ResumeSection title="Projects" defaultOpen={false}>
              <div className="flex flex-col gap-3">
                {content.projects.map((proj) => (
                  <div key={proj.source_id}>
                    <p className="text-sm font-medium text-[var(--w-text-primary)]">
                      {proj.name}
                    </p>
                    <p className="text-xs text-[var(--w-text-secondary)]">
                      {proj.description}
                    </p>
                    {proj.technologies.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {proj.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="rounded bg-[var(--w-surface-alt)] px-1.5 py-0.5 text-[10px] text-[var(--w-text-muted)]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ResumeSection>
          )}

          {/* Certifications */}
          {content.certifications && content.certifications.length > 0 && (
            <ResumeSection title="Certifications" defaultOpen={false}>
              <div className="flex flex-col gap-2">
                {content.certifications.map((cert) => (
                  <div key={cert.source_id}>
                    <p className="text-sm font-medium text-[var(--w-text-primary)]">
                      {cert.name}
                    </p>
                    {cert.issuer && (
                      <p className="text-xs text-[var(--w-text-muted)]">
                        {cert.issuer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ResumeSection>
          )}
        </div>

        {/* Right panel — Score Panel */}
        <div className="w-full shrink-0 overflow-y-auto p-4 lg:w-80 xl:w-96">
          <ScorePanel
            overallScore={overallScore}
            breakdown={breakdown}
            appliedIndices={appliedIndices}
            onApplySuggestion={handleApplySuggestion}
            onApplyAll={handleApplyAll}
            applyingIndex={applyingIndex}
            applyingAll={applyingAll}
          />
        </div>
      </div>

      {/* Improve Dialog */}
      {showImproveDialog && (
        <ImproveDialog
          resumeId={initial.id}
          isPaidPlan={isPaidPlan}
          onResult={handleImproveResult}
          onClose={() => setShowImproveDialog(false)}
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          resumeId={initial.id}
          isPaidPlan={isPaidPlan}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Change Review Overlay */}
      {improveResult && (
        <ChangeReview
          changeSummary={improveResult.change_summary}
          changes={improveResult.changes}
          improvedContent={improveResult.improved_content}
          onAcceptAll={handleAcceptAllChanges}
          onAcceptSelected={handleAcceptSelectedChanges}
          onRejectAll={() => setImproveResult(null)}
        />
      )}
    </div>
  );
}

// ── Helper components ──

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--w-text-muted)]">
        {label}
      </span>
      <p className="text-xs text-[var(--w-text-secondary)]">
        {value || "—"}
      </p>
    </div>
  );
}

function EditableText({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditVal(value);
  }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [editing]);

  function handleBlur() {
    setEditing(false);
    const trimmed = editVal.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={editVal}
        onChange={(e) => {
          setEditVal(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setEditVal(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className="w-full resize-none rounded border border-[var(--w-primary)] bg-[var(--w-surface)] px-2 py-1 text-xs leading-relaxed text-[var(--w-text-primary)] outline-none"
        rows={3}
      />
    );
  }

  return (
    <p
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className="cursor-text rounded px-1 py-0.5 text-xs leading-relaxed text-[var(--w-text-secondary)] transition-colors hover:bg-[var(--w-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--w-primary)]"
    >
      {value || (
        <span className="text-[var(--w-text-muted)]">
          {placeholder ?? "Click to edit..."}
        </span>
      )}
    </p>
  );
}

function SkillTags({
  skills,
  onAdd,
  onRemove,
}: {
  skills: string[];
  onAdd: (skill: string) => void;
  onRemove: (index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function handleSubmit() {
    const trimmed = newSkill.trim();
    if (trimmed) {
      onAdd(trimmed);
    }
    setNewSkill("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {skills.map((skill, i) => (
        <span
          key={`${skill}-${i}`}
          className="group flex items-center gap-1 rounded-full bg-[var(--w-surface-alt)] px-2.5 py-1 text-xs text-[var(--w-text-secondary)]"
        >
          {skill}
          <button
            onClick={() => onRemove(i)}
            className="text-[var(--w-text-muted)] opacity-0 transition-opacity hover:text-[#dc2626] group-hover:opacity-100"
            aria-label={`Remove ${skill}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setNewSkill("");
              setAdding(false);
            }
          }}
          className="rounded-full border border-[var(--w-primary)] bg-[var(--w-surface)] px-2.5 py-1 text-xs text-[var(--w-text-primary)] outline-none"
          placeholder="New skill..."
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-[var(--w-border)] px-2.5 py-1 text-xs text-[var(--w-text-muted)] hover:border-[var(--w-primary)] hover:text-[var(--w-primary)]"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      )}
    </div>
  );
}

/** Apply a generic suggestion by matching original text in the content. */
function applyGenericSuggestion(
  content: ResumeContent,
  suggestion: Suggestion
): ResumeContent | null {
  const updated = structuredClone(content);

  if (suggestion.section === "skills") {
    const idx = updated.skills.indexOf(suggestion.original);
    if (idx !== -1) {
      updated.skills[idx] = suggestion.suggested;
      return updated;
    }
  }

  if (suggestion.section === "header") {
    const header = updated.header as unknown as Record<
      string,
      string | null | undefined
    >;
    for (const key of Object.keys(header)) {
      if (header[key] === suggestion.original) {
        header[key] = suggestion.suggested;
        return updated;
      }
    }
  }

  return null;
}
