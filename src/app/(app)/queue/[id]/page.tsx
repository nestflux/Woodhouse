"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getApplicationDetail,
  updateApplicationMaterials,
  approveApplication,
  skipApplication,
  saveApplicationForLater,
  markAsSubmitted,
  type ApplicationDetail,
  type ApproveResult,
} from "@/lib/actions/applications";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  SkipForward,
  BookmarkPlus,
  Loader2,
  MapPin,
  Wifi,
  Briefcase,
  GraduationCap,
  Star,
  AlertTriangle,
  FileText,
  ExternalLink,
  Pencil,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Calendar,
  Building,
  Code,
  Award,
  FolderOpen,
  Download,
  Copy,
  Check,
  Send,
  Crown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--w-success)";
  if (score >= 60) return "var(--w-warning)";
  return "var(--w-error)";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  return "Weak";
}

function formatRecommendation(rec: string): string {
  return rec.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatJobType(jt: string | null): string | null {
  if (!jt) return null;
  return jt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null
): string | null {
  if (!min && !max) return null;
  const cur = currency ?? "USD";
  const fmt = (v: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(v);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

/* ------------------------------------------------------------------ */
/*  Resume content types (mirrors file-generation/types.ts)            */
/* ------------------------------------------------------------------ */

interface ResumeContent {
  header: {
    full_name: string;
    headline: string;
    email: string;
    phone?: string | null;
    location?: string | null;
    linkedin_url?: string | null;
    portfolio_url?: string | null;
  };
  summary: string;
  work_experience: Array<{
    source_id: string;
    company_name: string;
    job_title: string;
    location: string;
    start_date: string;
    end_date: string;
    achievements: Array<{ source_id: string; text: string }>;
  }>;
  skills: string[];
  education: Array<{
    source_id: string;
    institution: string;
    degree: string;
    field_of_study: string;
    dates: string;
  }>;
  projects?: Array<{
    source_id: string;
    name: string;
    description: string;
    technologies: string[];
  }>;
  certifications?: Array<{
    source_id: string;
    name: string;
    issuer: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Score Badge                                                        */
/* ------------------------------------------------------------------ */

function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const color = getScoreColor(score);
  const cls =
    size === "lg"
      ? "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white"
      : "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white";
  return (
    <span className={cls} style={{ backgroundColor: color }}>
      {score}% {getScoreLabel(score)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Dimension Score Bar                                                */
/* ------------------------------------------------------------------ */

function DimensionScore({
  label,
  score,
  icon: Icon,
}: {
  label: string;
  score: number | null;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (score === null || score === undefined) return null;
  const color = getScoreColor(score);
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-[var(--w-text-muted)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--w-text-secondary)]">{label}</span>
          <span className="font-medium text-[var(--w-text-primary)]">{score}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--w-surface-alt)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                       */
/* ------------------------------------------------------------------ */

function OverviewTab({
  app,
  onAction,
  isPending,
}: {
  app: ApplicationDetail;
  onAction: (action: "approve" | "skip" | "save") => void;
  isPending: boolean;
}) {
  const posting = app.job_postings;
  const evaluation = app.job_evaluations;
  const salary = formatSalary(posting.salary_min, posting.salary_max, posting.salary_currency);
  const jobType = formatJobType(posting.job_type);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Job Details */}
      <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5">
        <div className="flex items-start gap-3">
          {posting.company_logo_url && (
            <img
              src={posting.company_logo_url}
              alt={posting.company_name}
              className="h-12 w-12 shrink-0 rounded-[var(--radius-sm)] object-contain bg-[var(--w-surface-alt)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--w-text-primary)]">
              {posting.job_title}
            </h2>
            <p className="text-sm text-[var(--w-text-secondary)]">{posting.company_name}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-[var(--w-text-secondary)]">
          {(posting.location || posting.is_remote) && (
            <div className="flex items-center gap-2">
              {posting.is_remote ? (
                <Wifi className="h-4 w-4 text-[var(--w-text-muted)]" />
              ) : (
                <MapPin className="h-4 w-4 text-[var(--w-text-muted)]" />
              )}
              <span>{posting.is_remote ? "Remote" : posting.location}</span>
            </div>
          )}
          {jobType && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[var(--w-text-muted)]" />
              <span>{jobType}</span>
            </div>
          )}
          {posting.experience_level && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[var(--w-text-muted)]" />
              <span className="capitalize">{posting.experience_level} level</span>
            </div>
          )}
          {salary && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[var(--w-text-muted)]" />
              <span>{salary}</span>
            </div>
          )}
          {posting.posted_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--w-text-muted)]" />
              <span>Posted {new Date(posting.posted_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {(posting.required_skills.length > 0 || posting.preferred_skills.length > 0) && (
          <div className="mt-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--w-text-muted)]">
              Required Skills
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {posting.required_skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
            {posting.preferred_skills.length > 0 && (
              <>
                <h4 className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--w-text-muted)]">
                  Preferred Skills
                </h4>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {posting.preferred_skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {posting.application_url && (
          <a
            href={posting.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--w-primary)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View original posting
          </a>
        )}
      </div>

      {/* Evaluation Summary */}
      <div className="space-y-4">
        {evaluation ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--w-text-primary)]">
                Match Evaluation
              </h3>
              <ScoreBadge score={evaluation.overall_score} size="lg" />
            </div>
            <p className="mt-1 text-xs text-[var(--w-text-muted)]">
              {formatRecommendation(evaluation.recommendation)}
            </p>

            <div className="mt-4 space-y-3">
              <DimensionScore label="Skills" score={evaluation.skill_score} icon={Code} />
              <DimensionScore
                label="Experience"
                score={evaluation.experience_score}
                icon={Briefcase}
              />
              <DimensionScore
                label="Seniority"
                score={evaluation.seniority_score}
                icon={Award}
              />
              <DimensionScore
                label="Location"
                score={evaluation.location_score}
                icon={MapPin}
              />
              <DimensionScore
                label="Technology"
                score={evaluation.technology_score}
                icon={Building}
              />
            </div>

            {evaluation.reasoning && (
              <div className="mt-4">
                <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--w-text-muted)]">
                  Reasoning
                </h4>
                <p className="mt-1 text-sm text-[var(--w-text-secondary)] leading-relaxed">
                  {evaluation.reasoning}
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-4">
              {evaluation.strengths.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--w-success)]">
                    <Star className="h-3 w-3" />
                    Strengths
                  </h4>
                  <ul className="mt-1.5 space-y-1">
                    {evaluation.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="text-xs text-[var(--w-text-secondary)] leading-relaxed"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {evaluation.gaps.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--w-warning)]">
                    <AlertTriangle className="h-3 w-3" />
                    Gaps
                  </h4>
                  <ul className="mt-1.5 space-y-1">
                    {evaluation.gaps.map((g, i) => (
                      <li
                        key={i}
                        className="text-xs text-[var(--w-text-secondary)] leading-relaxed"
                      >
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-8 text-center">
            <p className="text-sm text-[var(--w-text-muted)]">No evaluation data available</p>
          </div>
        )}

        {/* Tailoring Notes */}
        {app.tailored_resume?.tailoring_notes && (
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5">
            <h3 className="text-sm font-semibold text-[var(--w-text-primary)]">Tailoring Notes</h3>
            <p className="mt-2 text-sm text-[var(--w-text-secondary)] leading-relaxed">
              {app.tailored_resume.tailoring_notes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {(app.status === "ready" || app.status === "saved") && (
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-1.5 bg-[var(--w-success)] text-white hover:bg-[var(--w-success)]/90"
              disabled={isPending}
              onClick={() => onAction("approve")}
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={isPending}
              onClick={() => onAction("save")}
            >
              <BookmarkPlus className="h-4 w-4" />
              Save for Later
            </Button>
            <Button
              variant="ghost"
              className="gap-1.5 text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)]"
              disabled={isPending}
              onClick={() => onAction("skip")}
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resume Tab                                                         */
/* ------------------------------------------------------------------ */

function ResumeTab({
  tailoredResume,
  baseResume,
}: {
  tailoredResume: ApplicationDetail["tailored_resume"];
  baseResume: ApplicationDetail["base_resume"];
}) {
  const [showDiff, setShowDiff] = useState(false);

  if (!tailoredResume) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <div>
          <FileText className="mx-auto h-12 w-12 text-[var(--w-text-muted)]" />
          <p className="mt-4 text-sm text-[var(--w-text-muted)]">
            No tailored resume available for this application.
          </p>
        </div>
      </div>
    );
  }

  const content = tailoredResume.content_json as unknown as ResumeContent;
  const baseContent = baseResume?.content_json as unknown as ResumeContent | undefined;

  // Build sets for diff comparison
  const baseAchievementTexts = new Set<string>();
  const baseSkills = new Set<string>();
  if (baseContent && showDiff) {
    baseContent.work_experience?.forEach((exp) =>
      exp.achievements?.forEach((a) => baseAchievementTexts.add(a.text))
    );
    baseContent.skills?.forEach((s) => baseSkills.add(s));
  }

  const isNewAchievement = (text: string) => showDiff && !baseAchievementTexts.has(text);
  const isNewSkill = (skill: string) => showDiff && !baseSkills.has(skill);
  const diffHighlight = "bg-[var(--w-success)]/10 border-l-2 border-[var(--w-success)] pl-2";

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex items-center gap-3">
        {baseResume && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? (
              <ToggleRight className="h-4 w-4 text-[var(--w-success)]" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            {showDiff ? "Diff View On" : "Toggle Diff View"}
          </Button>
        )}
        {showDiff && (
          <span className="text-xs text-[var(--w-text-muted)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--w-success)] mr-1" />
            Additions / modifications from base profile
          </span>
        )}
      </div>

      {/* Resume Document */}
      <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-8 shadow-sm max-w-3xl mx-auto">
        {/* Header */}
        {content.header && (
          <div className="text-center border-b border-[var(--w-border)] pb-4 mb-4">
            <h1 className="text-xl font-bold text-[var(--w-text-primary)]">{content.header.full_name}</h1>
            {content.header.headline && (
              <p className="mt-1 text-sm text-[var(--w-text-secondary)]">{content.header.headline}</p>
            )}
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-[var(--w-text-muted)] flex-wrap">
              {content.header.email && <span>{content.header.email}</span>}
              {content.header.phone && <span>{content.header.phone}</span>}
              {content.header.location && <span>{content.header.location}</span>}
              {content.header.linkedin_url && (
                <a
                  href={content.header.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--w-primary)] hover:underline"
                >
                  LinkedIn
                </a>
              )}
              {content.header.portfolio_url && (
                <a
                  href={content.header.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--w-primary)] hover:underline"
                >
                  Portfolio
                </a>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {content.summary && (
          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--w-text-primary)] border-b border-[var(--w-border)] pb-1 mb-2">
              Summary
            </h2>
            <p className="text-sm text-[var(--w-text-secondary)] leading-relaxed">{content.summary}</p>
          </div>
        )}

        {/* Work Experience */}
        {content.work_experience?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--w-text-primary)] border-b border-[var(--w-border)] pb-1 mb-2">
              Experience
            </h2>
            <div className="space-y-3">
              {content.work_experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-[var(--w-text-primary)]">
                      {exp.company_name}
                    </span>
                    <span className="text-xs text-[var(--w-text-muted)] shrink-0 ml-2">
                      {exp.start_date} – {exp.end_date || "Present"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-[var(--w-text-secondary)] italic">{exp.job_title}</span>
                    {exp.location && (
                      <span className="text-xs text-[var(--w-text-muted)] shrink-0 ml-2">{exp.location}</span>
                    )}
                  </div>
                  {exp.achievements?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {exp.achievements.map((ach, j) => (
                        <li
                          key={j}
                          className={`text-sm text-[var(--w-text-secondary)] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[var(--w-text-muted)] ${
                            isNewAchievement(ach.text) ? diffHighlight : ""
                          }`}
                        >
                          {ach.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {content.skills?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--w-text-primary)] border-b border-[var(--w-border)] pb-1 mb-2">
              Skills
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {content.skills.map((skill) => (
                <span
                  key={skill}
                  className={`inline-block rounded px-2 py-0.5 text-xs ${
                    isNewSkill(skill)
                      ? "bg-[var(--w-success)]/10 text-[var(--w-success)] font-medium"
                      : "bg-[var(--w-surface-alt)] text-[var(--w-text-secondary)]"
                  }`}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {content.education?.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--w-text-primary)] border-b border-[var(--w-border)] pb-1 mb-2">
              Education
            </h2>
            <div className="space-y-2">
              {content.education.map((edu, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-[var(--w-text-primary)]">
                      {edu.institution}
                    </span>
                    {edu.dates && (
                      <span className="text-xs text-[var(--w-text-muted)] shrink-0 ml-2">{edu.dates}</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--w-text-secondary)]">
                    {edu.degree}
                    {edu.field_of_study ? `, ${edu.field_of_study}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {content.projects && content.projects.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--w-text-primary)] border-b border-[var(--w-border)] pb-1 mb-2">
              Projects
            </h2>
            <div className="space-y-2">
              {content.projects.map((proj, i) => (
                <div key={i}>
                  <span className="text-sm font-semibold text-[var(--w-text-primary)]">{proj.name}</span>
                  <p className="text-sm text-[var(--w-text-secondary)]">{proj.description}</p>
                  {proj.technologies?.length > 0 && (
                    <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
                      {proj.technologies.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {content.certifications && content.certifications.length > 0 && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--w-text-primary)] border-b border-[var(--w-border)] pb-1 mb-2">
              Certifications
            </h2>
            <div className="space-y-1">
              {content.certifications.map((cert, i) => (
                <div key={i} className="text-sm text-[var(--w-text-secondary)]">
                  <span className="font-medium">{cert.name}</span>
                  {cert.issuer && <span className="text-[var(--w-text-muted)]"> — {cert.issuer}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cover Letter Tab                                                   */
/* ------------------------------------------------------------------ */

function CoverLetterTab({
  coverLetter,
  applicationId,
  onSaved,
}: {
  coverLetter: string | null;
  applicationId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(coverLetter ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(coverLetter ?? "");
  }, [coverLetter]);

  async function handleSave() {
    setSaving(true);
    const result = await updateApplicationMaterials(applicationId, {
      cover_letter: text,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Cover letter saved");
      setEditing(false);
      onSaved();
    }
  }

  if (!coverLetter && !editing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-[var(--w-text-muted)]" />
        <p className="mt-4 text-sm text-[var(--w-text-muted)]">
          No cover letter was generated for this application.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--w-text-primary)]">Cover Letter</h3>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setText(coverLetter ?? "");
                  setEditing(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-64 text-sm leading-relaxed"
        />
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
          <div className="whitespace-pre-wrap text-sm text-[var(--w-text-secondary)] leading-relaxed">
            {coverLetter}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Application Answers Tab                                            */
/* ------------------------------------------------------------------ */

interface AnswerItem {
  question: string;
  answer: string;
  source?: string;
}

function AnswersTab({
  answers,
  applicationId,
  onSaved,
}: {
  answers: AnswerItem[];
  applicationId: string;
  onSaved: () => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  if (!answers || answers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="h-12 w-12 text-[var(--w-text-muted)]" />
        <p className="mt-4 text-sm text-[var(--w-text-muted)]">
          No application questions were found for this posting.
        </p>
      </div>
    );
  }

  async function handleSave(idx: number) {
    setSaving(true);
    const updated = [...answers];
    updated[idx] = { ...updated[idx], answer: editText };
    const result = await updateApplicationMaterials(applicationId, {
      application_answers: updated,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Answer saved");
      setEditingIdx(null);
      onSaved();
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {answers.map((qa, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-sm font-medium text-[var(--w-text-primary)]">{qa.question}</h4>
            {editingIdx === i ? (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingIdx(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="xs"
                  className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                  disabled={saving}
                  onClick={() => handleSave(i)}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                onClick={() => {
                  setEditingIdx(i);
                  setEditText(qa.answer);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {editingIdx === i ? (
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="mt-2 min-h-24 text-sm"
            />
          ) : (
            <p className="mt-2 text-sm text-[var(--w-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {qa.answer}
            </p>
          )}

          {qa.source && editingIdx !== i && (
            <p className="mt-2 text-xs text-[var(--w-text-muted)] italic">
              Source: {qa.source}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Job Posting Tab                                                    */
/* ------------------------------------------------------------------ */

function JobPostingTab({ posting }: { posting: ApplicationDetail["job_postings"] }) {
  return (
    <div className="max-w-3xl">
      <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
        <div className="flex items-start gap-3 mb-4">
          {posting.company_logo_url && (
            <img
              src={posting.company_logo_url}
              alt={posting.company_name}
              className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)] object-contain bg-[var(--w-surface-alt)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div>
            <h2 className="text-lg font-semibold text-[var(--w-text-primary)]">
              {posting.job_title}
            </h2>
            <p className="text-sm text-[var(--w-text-secondary)]">{posting.company_name}</p>
          </div>
        </div>

        {posting.responsibilities.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-2">
              Responsibilities
            </h3>
            <ul className="space-y-1">
              {posting.responsibilities.map((r, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--w-text-secondary)] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[var(--w-text-muted)]"
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {posting.benefits.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-2">Benefits</h3>
            <ul className="space-y-1">
              {posting.benefits.map((b, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--w-text-secondary)] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[var(--w-text-muted)]"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-[var(--w-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-2">
            Full Description
          </h3>
          <div className="prose prose-sm max-w-none text-[var(--w-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {posting.description_raw}
          </div>
        </div>

        {posting.application_url && (
          <div className="mt-4 pt-4 border-t border-[var(--w-border)]">
            <a
              href={posting.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--w-primary)] hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open application page
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-5xl animate-pulse">
      <div className="h-5 w-24 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="h-8 w-64 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-48 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="h-10 w-full bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        <div className="h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

type DetailTab = "overview" | "resume" | "cover-letter" | "answers" | "job-posting";

const DETAIL_TABS: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "resume", label: "Resume" },
  { value: "cover-letter", label: "Cover Letter" },
  { value: "answers", label: "Answers" },
  { value: "job-posting", label: "Job Posting" },
];

/* ------------------------------------------------------------------ */
/*  Copy Button                                                        */
/* ------------------------------------------------------------------ */

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label ? `${label} copied` : "Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <Button variant="ghost" size="xs" className="gap-1 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--w-success)]" /> : <Copy className="h-3.5 w-3.5" />}
      {label && <span className="text-xs">{label}</span>}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/*  Post-Approval Banner                                               */
/* ------------------------------------------------------------------ */

function ApprovedBanner({
  approveResult,
  app,
  onSubmitted,
  isPending,
}: {
  approveResult: ApproveResult | null;
  app: ApplicationDetail;
  onSubmitted: () => void;
  isPending: boolean;
}) {
  const pdfUrl = approveResult?.resume_pdf_url ?? app.tailored_resume?.file_url_pdf;
  const docxUrl = approveResult?.resume_docx_url ?? app.tailored_resume?.file_url_docx;
  const applicationUrl =
    approveResult?.application_url ?? app.job_postings.application_url;
  const coverLetter = approveResult?.cover_letter ?? app.cover_letter;
  const answers = (approveResult?.application_answers ??
    app.application_answers ??
    []) as AnswerItem[];

  return (
    <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--w-success)] bg-[var(--w-success)]/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-5 w-5 text-[var(--w-success)]" />
        <h3 className="text-sm font-semibold text-[var(--w-text-primary)]">
          Application Approved
        </h3>
      </div>

      {/* Download & Application Links */}
      <div className="flex flex-wrap gap-2 mb-4">
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          </a>
        )}
        {docxUrl && (
          <a href={docxUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Download DOCX
            </Button>
          </a>
        )}
        {applicationUrl && (
          <a href={applicationUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Open Application
            </Button>
          </a>
        )}
      </div>

      {/* Copy Buttons */}
      {(coverLetter || answers.length > 0) && (
        <div className="space-y-2 mb-4">
          {coverLetter && (
            <div className="flex items-center gap-2">
              <CopyButton text={coverLetter} label="Cover Letter" />
            </div>
          )}
          {answers.map((qa, i) => (
            <div key={i} className="flex items-center gap-2">
              <CopyButton text={qa.answer} label={qa.question} />
            </div>
          ))}
        </div>
      )}

      {/* Mark as Submitted */}
      {app.status === "approved" && (
        <Button
          className="gap-1.5 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
          disabled={isPending}
          onClick={onSubmitted}
        >
          <Send className="h-4 w-4" />
          I've Submitted This Application
        </Button>
      )}

      {app.status === "submitted" && (
        <div className="flex items-center gap-2 text-sm text-[var(--w-text-secondary)]">
          <Check className="h-4 w-4 text-[var(--w-success)]" />
          Submitted
          {app.submitted_at && (
            <span className="text-[var(--w-text-muted)]">
              on {new Date(app.submitted_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Upgrade Prompt                                                     */
/* ------------------------------------------------------------------ */

function UpgradePrompt({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[var(--w-warning)]" />
            <DialogTitle>Application Limit Reached</DialogTitle>
          </div>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={() => {
              onClose();
              window.location.href = "/settings/subscription";
            }}
          >
            <Crown className="h-4 w-4 mr-1.5" />
            Upgrade Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [isPending, startTransition] = useTransition();

  // Approval flow state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    const result = await getApplicationDetail(applicationId);
    if (result.data) {
      setApp(result.data);
      setError(null);
    } else {
      setError(result.error ?? "Failed to load application");
    }
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  function handleAction(action: "approve" | "skip" | "save") {
    if (!app) return;

    if (action === "approve") {
      setShowConfirmModal(true);
      return;
    }

    startTransition(async () => {
      let result: { error?: string };
      switch (action) {
        case "skip":
          result = await skipApplication(app.id);
          if (!result.error) {
            toast.success("Application skipped");
            router.push("/queue");
          }
          break;
        case "save":
          result = await saveApplicationForLater(app.id);
          if (!result.error) {
            toast.success("Saved for later");
            router.push("/queue");
          }
          break;
        default:
          return;
      }
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  async function handleConfirmApprove() {
    if (!app) return;
    setApproving(true);
    const result = await approveApplication(app.id);
    setApproving(false);
    setShowConfirmModal(false);

    if (result.limitExceeded) {
      setUpgradeMessage(result.error ?? "Application limit reached");
      return;
    }

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setApproveResult(result.data);
      toast.success("Application approved");

      // Open application URL in new tab
      if (result.data.application_url) {
        window.open(result.data.application_url, "_blank", "noopener,noreferrer");
      }

      // Auto-copy first answer to clipboard
      const firstAnswer = result.data.application_answers?.[0];
      if (firstAnswer) {
        try {
          await navigator.clipboard.writeText(firstAnswer.answer);
          toast.success("First answer copied to clipboard");
        } catch {
          // Clipboard may not be available — non-fatal
        }
      }

      // Refresh to get updated status
      await fetchDetail();
    }
  }

  function handleMarkSubmitted() {
    if (!app) return;
    startTransition(async () => {
      const result = await markAsSubmitted(app.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Application marked as submitted");
        await fetchDetail();
      }
    });
  }

  if (loading) return <DetailSkeleton />;

  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center p-6">
        <AlertTriangle className="h-12 w-12 text-[var(--w-error)]" />
        <h2 className="mt-4 text-lg font-semibold text-[var(--w-text-primary)]">
          Application not found
        </h2>
        <p className="mt-1 text-sm text-[var(--w-text-muted)]">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/queue")}>
          Back to Queue
        </Button>
      </div>
    );
  }

  const answers = (app.application_answers ?? []) as AnswerItem[];
  const isApprovedOrSubmitted = app.status === "approved" || app.status === "submitted";

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Back link */}
      <button
        onClick={() => router.push("/queue")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            {app.job_postings.job_title}
          </h1>
          {app.job_evaluations && (
            <ScoreBadge score={app.job_evaluations.overall_score} size="lg" />
          )}
          <Badge
            variant={isApprovedOrSubmitted ? "default" : "secondary"}
            className="capitalize"
          >
            {app.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          {app.job_postings.company_name}
        </p>
      </div>

      {/* Post-Approval Banner */}
      {isApprovedOrSubmitted && (
        <ApprovedBanner
          approveResult={approveResult}
          app={app}
          onSubmitted={handleMarkSubmitted}
          isPending={isPending}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
        <TabsList variant="line" className="mb-6">
          {DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab app={app} onAction={handleAction} isPending={isPending} />
        </TabsContent>

        <TabsContent value="resume">
          <ResumeTab
            tailoredResume={app.tailored_resume}
            baseResume={app.base_resume}
          />
        </TabsContent>

        <TabsContent value="cover-letter">
          <CoverLetterTab
            coverLetter={app.cover_letter}
            applicationId={app.id}
            onSaved={fetchDetail}
          />
        </TabsContent>

        <TabsContent value="answers">
          <AnswersTab
            answers={answers}
            applicationId={app.id}
            onSaved={fetchDetail}
          />
        </TabsContent>

        <TabsContent value="job-posting">
          <JobPostingTab posting={app.job_postings} />
        </TabsContent>
      </Tabs>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Application</DialogTitle>
            <DialogDescription>
              Your resume files will be generated and the application link will open in
              a new tab. You can then download your tailored resume and submit your
              application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              disabled={approving}
            >
              Cancel
            </Button>
            <Button
              className="gap-1.5 bg-[var(--w-success)] text-white hover:bg-[var(--w-success)]/90"
              onClick={handleConfirmApprove}
              disabled={approving}
            >
              {approving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Prompt */}
      {upgradeMessage && (
        <UpgradePrompt
          message={upgradeMessage}
          onClose={() => setUpgradeMessage(null)}
        />
      )}
    </div>
  );
}
