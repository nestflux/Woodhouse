"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getJobDetail,
  prepareApplication,
  type JobDetail,
} from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Briefcase,
  MapPin,
  Wifi,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Star,
  GraduationCap,
  Code,
  DollarSign,
  Calendar,
  Building,
  Globe,
  ClipboardList,
  Award,
  Sparkles,
  FileText,
  ArrowRight,
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
  if (score >= 80) return "Strong Match";
  if (score >= 60) return "Good Match";
  return "Weak Match";
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

function formatSource(source: string): string {
  const map: Record<string, string> = {
    google_jobs: "Google Jobs",
    jsearch: "JSearch",
    greenhouse: "Greenhouse",
    lever: "Lever",
    workday: "Workday",
    manual: "Manual",
    email: "Email",
    linkedin: "LinkedIn",
    indeed: "Indeed",
  };
  return map[source] ?? source;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Score Badge (large)                                                */
/* ------------------------------------------------------------------ */

function ScoreBadgeLarge({ score }: { score: number }) {
  const color = getScoreColor(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {score}
      </div>
      <span className="text-sm font-semibold" style={{ color }}>
        {getScoreLabel(score)}
      </span>
    </div>
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
          <span className="font-medium text-[var(--w-text-primary)]">
            {score}%
          </span>
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
/*  Section Component                                                  */
/* ------------------------------------------------------------------ */

function DescriptionSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--w-text-primary)] mb-2">
        <Icon className="h-4 w-4 text-[var(--w-primary)]" />
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-6xl animate-pulse">
      {/* Back button */}
      <div className="h-8 w-24 bg-[var(--w-surface-alt)] rounded mb-6" />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
          <div>
            <div className="h-6 w-48 bg-[var(--w-surface-alt)] rounded mb-2" />
            <div className="h-4 w-32 bg-[var(--w-surface-alt)] rounded" />
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="h-40 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
          <div className="h-32 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
          <div className="h-32 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        </div>
        <div className="lg:col-span-2">
          <div className="h-96 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getJobDetail(jobId);
    if (result.data) {
      setJob(result.data);
    } else if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  function handlePrepare() {
    startTransition(async () => {
      const result = await prepareApplication(jobId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        toast.success("Application created — tailoring pipeline started");
        router.push(`/queue/${result.data.applicationId}`);
      }
    });
  }

  if (loading) return <DetailSkeleton />;

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <AlertTriangle className="h-12 w-12 text-[var(--w-error)]" />
        <h2 className="mt-4 text-lg font-semibold text-[var(--w-text-primary)]">
          Job Not Found
        </h2>
        <p className="mt-1 text-sm text-[var(--w-text-muted)]">
          {error ?? "This job posting could not be loaded."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1"
          onClick={() => router.push("/jobs")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Job Feed
        </Button>
      </div>
    );
  }

  const evaluation = job.evaluation;
  const structured = job.descriptionStructured;
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const jobType = formatJobType(job.jobType);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1 text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)]"
        onClick={() => router.push("/jobs")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Job Feed
      </Button>

      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        {job.companyLogoUrl ? (
          <img
            src={job.companyLogoUrl}
            alt={job.companyName}
            className="h-14 w-14 shrink-0 rounded-[var(--radius-md)] object-contain bg-[var(--w-surface-alt)] border border-[var(--w-border)]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-[var(--radius-md)] bg-[var(--w-surface-alt)] border border-[var(--w-border)] flex items-center justify-center">
            <Building className="h-7 w-7 text-[var(--w-text-muted)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-[var(--w-text-primary)]">
            {job.jobTitle}
          </h1>
          <p className="text-sm text-[var(--w-text-secondary)]">
            {job.companyName}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--w-text-muted)] flex-wrap">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
            {job.isRemote && (
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                Remote
              </span>
            )}
            {job.country && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {job.country}
              </span>
            )}
            {jobType && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {jobType}
              </span>
            )}
            {job.experienceLevel && (
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {formatRecommendation(job.experienceLevel)}
              </span>
            )}
            {salary && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {salary}
              </span>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {formatSource(job.source)}
            </Badge>
            {job.postedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Posted {formatDate(job.postedDate)}
              </span>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 ${
                job.status === "active"
                  ? "border-[var(--w-success)] text-[var(--w-success)]"
                  : "border-[var(--w-text-muted)] text-[var(--w-text-muted)]"
              }`}
            >
              {job.status === "active" ? "Active" : "Expired"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column — Job Description (60%) */}
        <div className="lg:col-span-3">
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5">
            {/* About the Role */}
            {structured?.about && (
              <DescriptionSection title="About the Role" icon={FileText}>
                <p className="text-sm text-[var(--w-text-secondary)] whitespace-pre-line leading-relaxed">
                  {structured.about}
                </p>
              </DescriptionSection>
            )}

            {/* Responsibilities */}
            {((structured?.responsibilities &&
              structured.responsibilities.length > 0) ||
              job.responsibilities.length > 0) && (
              <DescriptionSection
                title="Responsibilities"
                icon={ClipboardList}
              >
                <ul className="space-y-1.5 text-sm text-[var(--w-text-secondary)]">
                  {(
                    structured?.responsibilities ?? job.responsibilities
                  ).map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--w-primary)]" />
                      {r}
                    </li>
                  ))}
                </ul>
              </DescriptionSection>
            )}

            {/* Requirements */}
            {((structured?.requirements &&
              structured.requirements.length > 0) ||
              job.requiredSkills.length > 0) && (
              <DescriptionSection title="Requirements" icon={Star}>
                <ul className="space-y-1.5 text-sm text-[var(--w-text-secondary)]">
                  {(structured?.requirements ?? []).map((r, i) => (
                    <li key={`req-${i}`} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--w-primary)]" />
                      {r}
                    </li>
                  ))}
                </ul>
                {job.requiredSkills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.requiredSkills.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="text-xs bg-[var(--w-surface-alt)]"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </DescriptionSection>
            )}

            {/* Preferred Qualifications */}
            {((structured?.preferred && structured.preferred.length > 0) ||
              job.preferredSkills.length > 0) && (
              <DescriptionSection
                title="Preferred Qualifications"
                icon={Sparkles}
              >
                <ul className="space-y-1.5 text-sm text-[var(--w-text-secondary)]">
                  {(structured?.preferred ?? []).map((p, i) => (
                    <li key={`pref-${i}`} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--w-accent)]" />
                      {p}
                    </li>
                  ))}
                </ul>
                {job.preferredSkills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.preferredSkills.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="text-xs bg-[var(--w-surface-alt)] border-[var(--w-accent)] text-[var(--w-accent)]"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </DescriptionSection>
            )}

            {/* Benefits */}
            {((structured?.benefits && structured.benefits.length > 0) ||
              job.benefits.length > 0) && (
              <DescriptionSection title="Benefits" icon={Award}>
                <ul className="space-y-1.5 text-sm text-[var(--w-text-secondary)]">
                  {(structured?.benefits ?? job.benefits).map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--w-success)]" />
                      {b}
                    </li>
                  ))}
                </ul>
              </DescriptionSection>
            )}

            {/* Application Link */}
            {job.applicationUrl && (
              <DescriptionSection title="Application Link" icon={ExternalLink}>
                <a
                  href={job.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--w-primary)] hover:underline"
                >
                  Apply directly
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DescriptionSection>
            )}

            {/* Raw Description Fallback */}
            {!structured?.about &&
              !structured?.responsibilities?.length &&
              !structured?.requirements?.length &&
              job.responsibilities.length === 0 &&
              job.requiredSkills.length === 0 && (
                <DescriptionSection title="Job Description" icon={FileText}>
                  <p className="text-sm text-[var(--w-text-secondary)] whitespace-pre-line leading-relaxed">
                    {job.descriptionRaw}
                  </p>
                </DescriptionSection>
              )}

            {/* Source URL */}
            {job.sourceUrl && (
              <div className="mt-4 pt-4 border-t border-[var(--w-border)]">
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)]"
                >
                  View original posting
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Evaluation Card (40%) */}
        <div className="lg:col-span-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5 sticky top-6">
            {evaluation ? (
              <>
                {/* Overall Score */}
                <div className="flex flex-col items-center mb-5">
                  <ScoreBadgeLarge score={evaluation.overallScore} />
                  <Badge
                    variant="outline"
                    className="mt-2 text-xs"
                    style={{
                      borderColor: getScoreColor(evaluation.overallScore),
                      color: getScoreColor(evaluation.overallScore),
                    }}
                  >
                    {formatRecommendation(evaluation.recommendation)}
                  </Badge>
                </div>

                {/* Dimension Scores */}
                <div className="space-y-3 mb-5">
                  <DimensionScore
                    label="Skills"
                    score={evaluation.skillScore}
                    icon={Code}
                  />
                  <DimensionScore
                    label="Experience"
                    score={evaluation.experienceScore}
                    icon={Briefcase}
                  />
                  <DimensionScore
                    label="Seniority"
                    score={evaluation.seniorityScore}
                    icon={GraduationCap}
                  />
                  <DimensionScore
                    label="Location"
                    score={evaluation.locationScore}
                    icon={MapPin}
                  />
                  <DimensionScore
                    label="Technology"
                    score={evaluation.technologyScore}
                    icon={Star}
                  />
                </div>

                {/* Strengths */}
                {evaluation.strengths.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--w-text-muted)] mb-2">
                      Strengths
                    </h4>
                    <ul className="space-y-1.5">
                      {evaluation.strengths.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-[var(--w-text-secondary)]"
                        >
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--w-success)]" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps */}
                {evaluation.gaps.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--w-text-muted)] mb-2">
                      Gaps
                    </h4>
                    <ul className="space-y-1.5">
                      {evaluation.gaps.map((g, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-[var(--w-text-secondary)]"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--w-warning)]" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Reasoning */}
                {evaluation.reasoning && (
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--w-text-muted)] mb-2">
                      Reasoning
                    </h4>
                    <p className="text-xs text-[var(--w-text-secondary)] leading-relaxed">
                      {evaluation.reasoning}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-[var(--w-text-muted)]" />
                <p className="mt-2 text-sm text-[var(--w-text-muted)]">
                  No evaluation available for this job.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="border-t border-[var(--w-border)] pt-4 space-y-2">
              {job.applicationId ? (
                <>
                  {job.applicationStatus && (
                    <p className="text-xs text-center text-[var(--w-text-muted)] mb-2">
                      Application status:{" "}
                      <span className="font-medium text-[var(--w-text-secondary)]">
                        {formatRecommendation(job.applicationStatus)}
                      </span>
                    </p>
                  )}
                  <Button
                    className="w-full gap-2 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                    onClick={() => router.push(`/queue/${job.applicationId}`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                    View Application
                  </Button>
                </>
              ) : evaluation?.passesThreshold ? (
                <Button
                  className="w-full gap-2 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                  disabled={isPending}
                  onClick={handlePrepare}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Briefcase className="h-4 w-4" />
                  )}
                  Prepare Application
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-[var(--w-warning)] text-[var(--w-warning)] hover:bg-[var(--w-warning-bg)]"
                  disabled={isPending}
                  onClick={handlePrepare}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Below Threshold — Prepare Anyway
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
