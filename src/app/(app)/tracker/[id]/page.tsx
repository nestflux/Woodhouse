"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getTrackerDetail,
  updateTrackerStatus,
  addApplicationNote,
  setApplicationReminder,
  TRACKER_STATUSES,
  type TrackerDetail,
  type ApplicationEvent,
} from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Bell,
  Download,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  Briefcase,
  Target,
  TrendingUp,
  BarChart3,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  acknowledged: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  screening: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  interviewing: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  offer: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  accepted: "bg-green-500/10 text-green-700 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  withdrawn: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const EVENT_ICONS: Record<string, typeof Clock> = {
  created: Briefcase,
  materials_generated: FileText,
  approved: CheckCircle2,
  submitted: Send,
  response_received: MessageSquare,
  interview_scheduled: CalendarDays,
  interview_completed: CheckCircle2,
  offer_received: TrendingUp,
  accepted: CheckCircle2,
  rejected: XCircle,
  withdrawn: AlertCircle,
  note_added: MessageSquare,
  follow_up_sent: Send,
  status_changed: Clock,
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-[var(--w-success)]";
  if (score >= 60) return "text-[var(--w-warning)]";
  return "text-[var(--w-error)]";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-[var(--w-success)]/10 border-[var(--w-success)]/20";
  if (score >= 60) return "bg-[var(--w-warning)]/10 border-[var(--w-warning)]/20";
  return "bg-[var(--w-error)]/10 border-[var(--w-error)]/20";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-pulse">
      <div className="h-4 w-24 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="h-8 w-64 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-5 w-48 bg-[var(--w-surface-alt)] rounded mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
          <div className="h-48 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        </div>
        <div className="space-y-6">
          <div className="h-40 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
          <div className="h-32 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score Dimension Bar                                                */
/* ------------------------------------------------------------------ */

function DimensionBar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  if (score === null) return null;
  const width = `${score}%`;
  const barColor =
    score >= 80
      ? "bg-[var(--w-success)]"
      : score >= 60
        ? "bg-[var(--w-warning)]"
        : "bg-[var(--w-error)]";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--w-text-secondary)] w-24 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 bg-[var(--w-surface-alt)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width }}
        />
      </div>
      <span className="text-xs font-medium text-[var(--w-text-primary)] w-8 text-right">
        {score}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  badge,
}: {
  title: string;
  icon: typeof Clock;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--w-surface-alt)] transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-[var(--w-text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--w-text-muted)]" />
        )}
        <Icon className="h-4 w-4 text-[var(--w-text-secondary)]" />
        <span className="text-sm font-medium text-[var(--w-text-primary)] flex-1">
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline Event                                                     */
/* ------------------------------------------------------------------ */

function TimelineEvent({
  event,
  isLast,
}: {
  event: ApplicationEvent;
  isLast: boolean;
}) {
  const Icon = EVENT_ICONS[event.event_type] ?? Clock;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-7 w-7 rounded-full bg-[var(--w-surface-alt)] border border-[var(--w-border)] flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-[var(--w-text-secondary)]" />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-[var(--w-border)] min-h-[16px]" />
        )}
      </div>
      <div className="pb-4 pt-0.5">
        <p className="text-sm text-[var(--w-text-primary)]">
          {event.description ?? event.event_type.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
          {formatDateTime(event.created_at)} &middot;{" "}
          {relativeTime(event.created_at)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function TrackerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<TrackerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update
  const [statusPending, startStatusTransition] = useTransition();

  // Note
  const [noteText, setNoteText] = useState("");
  const [notePending, startNoteTransition] = useTransition();

  // Reminder
  const [reminderDate, setReminderDate] = useState("");
  const [reminderPending, startReminderTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const result = await getTrackerDetail(params.id);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setDetail(result.data);
        if (result.data.next_step_date) {
          setReminderDate(result.data.next_step_date.split("T")[0]);
        }
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  function handleStatusChange(newStatus: string) {
    if (!detail || newStatus === detail.status) return;
    const previousStatus = detail.status;
    setDetail({ ...detail, status: newStatus });

    startStatusTransition(async () => {
      const result = await updateTrackerStatus(params.id, newStatus);
      if (result.error) {
        toast.error(result.error);
        setDetail((d) => (d ? { ...d, status: previousStatus } : d));
      } else {
        toast.success(`Status updated to ${STATUS_LABELS[newStatus] ?? newStatus}`);
        // Reload to get updated events
        const refreshed = await getTrackerDetail(params.id);
        if (refreshed.data) setDetail(refreshed.data);
      }
    });
  }

  function handleAddNote() {
    if (!noteText.trim()) return;

    startNoteTransition(async () => {
      const result = await addApplicationNote(params.id, noteText);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Note added");
        setNoteText("");
        // Reload to get updated events
        const refreshed = await getTrackerDetail(params.id);
        if (refreshed.data) setDetail(refreshed.data);
      }
    });
  }

  function handleSetReminder() {
    startReminderTransition(async () => {
      const dateValue = reminderDate || null;
      const result = await setApplicationReminder(params.id, dateValue);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dateValue ? "Reminder set" : "Reminder cleared");
        setDetail((d) => (d ? { ...d, next_step_date: dateValue } : d));
      }
    });
  }

  if (loading) return <DetailSkeleton />;

  if (error || !detail) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/tracker")}
          className="flex items-center gap-1.5 text-sm text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tracker
        </button>
        <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-8 text-center">
          <AlertCircle className="h-8 w-8 text-[var(--w-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--w-text-secondary)]">
            {error ?? "Application not found"}
          </p>
        </div>
      </div>
    );
  }

  const jp = detail.job_postings;
  const ev = detail.job_evaluations;
  const score = ev?.overall_score ?? null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Back Link */}
      <button
        onClick={() => router.push("/tracker")}
        className="flex items-center gap-1.5 text-sm text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tracker
      </button>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        {/* Company Icon */}
        <div className="h-12 w-12 rounded-[var(--radius-md)] bg-[var(--w-surface-alt)] border border-[var(--w-border)] flex items-center justify-center shrink-0">
          {jp.company_logo_url ? (
            <img
              src={jp.company_logo_url}
              alt={jp.company_name}
              className="h-8 w-8 object-contain rounded"
            />
          ) : (
            <Building2 className="h-5 w-5 text-[var(--w-text-muted)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[var(--w-text-primary)] truncate">
            {jp.job_title}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-[var(--w-text-secondary)]">
              {jp.company_name}
            </span>
            {jp.location && (
              <span className="flex items-center gap-1 text-xs text-[var(--w-text-muted)]">
                <MapPin className="h-3 w-3" />
                {jp.location}
                {jp.is_remote && " (Remote)"}
              </span>
            )}
          </div>

          {/* Status Badge + Score */}
          <div className="flex items-center gap-3 mt-3">
            <span
              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[detail.status] ?? "bg-gray-500/10 text-gray-500"}`}
            >
              {STATUS_LABELS[detail.status] ?? detail.status}
            </span>
            {score !== null && (
              <span
                className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full border ${scoreBgColor(score)} ${scoreColor(score)}`}
              >
                {score}% Match
              </span>
            )}
            {detail.submitted_at && (
              <span className="text-xs text-[var(--w-text-muted)]">
                Submitted {formatDate(detail.submitted_at)}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {jp.application_url && (
            <a
              href={jp.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] text-[var(--w-text-secondary)] hover:bg-[var(--w-surface-alt)] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Job Link
            </a>
          )}
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Timeline, Materials, Evaluation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <CollapsibleSection
            title="Timeline"
            icon={Clock}
            defaultOpen
            badge={
              <span className="text-xs text-[var(--w-text-muted)] bg-[var(--w-surface-alt)] px-2 py-0.5 rounded-full">
                {detail.events.length}
              </span>
            }
          >
            {detail.events.length === 0 ? (
              <p className="text-sm text-[var(--w-text-muted)] py-2">
                No events recorded yet.
              </p>
            ) : (
              <div className="mt-2">
                {detail.events.map((event, i) => (
                  <TimelineEvent
                    key={event.id}
                    event={event}
                    isLast={i === detail.events.length - 1}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Materials */}
          <CollapsibleSection title="Materials" icon={FileText} defaultOpen>
            <div className="space-y-4 mt-2">
              {/* Tailored Resume */}
              {detail.tailored_resume && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--w-text-secondary)] uppercase tracking-wider mb-2">
                    Tailored Resume
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.tailored_resume.file_url_pdf && (
                      <a
                        href={detail.tailored_resume.file_url_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] text-[var(--w-text-secondary)] hover:bg-[var(--w-surface-alt)] transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download PDF
                      </a>
                    )}
                    {detail.tailored_resume.file_url_docx && (
                      <a
                        href={detail.tailored_resume.file_url_docx}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] text-[var(--w-text-secondary)] hover:bg-[var(--w-surface-alt)] transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download DOCX
                      </a>
                    )}
                  </div>
                  {detail.tailored_resume.tailoring_notes && (
                    <p className="text-xs text-[var(--w-text-muted)] mt-2 italic">
                      {detail.tailored_resume.tailoring_notes}
                    </p>
                  )}
                  {detail.tailored_resume.content_markdown && (
                    <details className="mt-3">
                      <summary className="text-xs text-[var(--w-accent)] cursor-pointer hover:underline">
                        Preview resume content
                      </summary>
                      <pre className="mt-2 p-3 text-xs text-[var(--w-text-secondary)] bg-[var(--w-surface-alt)] rounded-[var(--radius-sm)] overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {detail.tailored_resume.content_markdown}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Cover Letter */}
              {detail.cover_letter && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--w-text-secondary)] uppercase tracking-wider mb-2">
                    Cover Letter
                  </h4>
                  <pre className="p-3 text-xs text-[var(--w-text-secondary)] bg-[var(--w-surface-alt)] rounded-[var(--radius-sm)] overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {detail.cover_letter}
                  </pre>
                </div>
              )}

              {/* Application Answers */}
              {detail.application_answers &&
                detail.application_answers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--w-text-secondary)] uppercase tracking-wider mb-2">
                      Application Answers
                    </h4>
                    <div className="space-y-3">
                      {detail.application_answers.map((qa, i) => (
                        <div
                          key={i}
                          className="p-3 bg-[var(--w-surface-alt)] rounded-[var(--radius-sm)]"
                        >
                          <p className="text-xs font-medium text-[var(--w-text-primary)] mb-1">
                            {qa.question}
                          </p>
                          <p className="text-xs text-[var(--w-text-secondary)]">
                            {qa.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* No materials */}
              {!detail.tailored_resume &&
                !detail.cover_letter &&
                (!detail.application_answers ||
                  detail.application_answers.length === 0) && (
                  <p className="text-sm text-[var(--w-text-muted)] py-2">
                    No materials generated yet.
                  </p>
                )}
            </div>
          </CollapsibleSection>

          {/* Evaluation */}
          {ev && (
            <CollapsibleSection title="Evaluation" icon={BarChart3}>
              <div className="space-y-4 mt-2">
                {/* Overall Score */}
                <div className="flex items-center gap-3">
                  <span
                    className={`text-3xl font-bold ${scoreColor(ev.overall_score)}`}
                  >
                    {ev.overall_score}
                  </span>
                  <span className="text-sm text-[var(--w-text-secondary)]">
                    Overall Match Score
                  </span>
                </div>

                {/* Dimension Bars */}
                <div className="space-y-2">
                  <DimensionBar label="Skills" score={ev.skill_score} />
                  <DimensionBar label="Experience" score={ev.experience_score} />
                  <DimensionBar label="Seniority" score={ev.seniority_score} />
                  <DimensionBar label="Location" score={ev.location_score} />
                  <DimensionBar label="Technology" score={ev.technology_score} />
                </div>

                {/* Reasoning */}
                {ev.reasoning && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--w-text-secondary)] uppercase tracking-wider mb-1">
                      Analysis
                    </h4>
                    <p className="text-xs text-[var(--w-text-secondary)] leading-relaxed">
                      {ev.reasoning}
                    </p>
                  </div>
                )}

                {/* Strengths & Gaps */}
                {ev.strengths && ev.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--w-success)] uppercase tracking-wider mb-1">
                      Strengths
                    </h4>
                    <ul className="space-y-1">
                      {ev.strengths.map((s, i) => (
                        <li
                          key={i}
                          className="text-xs text-[var(--w-text-secondary)] flex items-start gap-1.5"
                        >
                          <CheckCircle2 className="h-3 w-3 text-[var(--w-success)] mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ev.gaps && ev.gaps.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--w-warning)] uppercase tracking-wider mb-1">
                      Gaps
                    </h4>
                    <ul className="space-y-1">
                      {ev.gaps.map((g, i) => (
                        <li
                          key={i}
                          className="text-xs text-[var(--w-text-secondary)] flex items-start gap-1.5"
                        >
                          <AlertCircle className="h-3 w-3 text-[var(--w-warning)] mt-0.5 shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                <div className="pt-2 border-t border-[var(--w-border)]">
                  <span className="text-xs text-[var(--w-text-muted)]">
                    Recommendation:{" "}
                    <span className="font-medium text-[var(--w-text-primary)] capitalize">
                      {ev.recommendation.replace(/_/g, " ")}
                    </span>
                  </span>
                </div>
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Right Column — Actions, Notes, Reminder */}
        <div className="space-y-6">
          {/* Update Status */}
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-[var(--w-text-secondary)]" />
              <h3 className="text-sm font-medium text-[var(--w-text-primary)]">
                Update Status
              </h3>
            </div>
            <div className="relative">
              <select
                value={detail.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusPending}
                className="w-full h-9 appearance-none rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] pl-3 pr-8 text-sm text-[var(--w-text-secondary)] cursor-pointer disabled:opacity-50"
              >
                {TRACKER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w-text-muted)] pointer-events-none" />
            </div>
            {statusPending && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--w-text-muted)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating...
              </div>
            )}
          </div>

          {/* Add Note */}
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-[var(--w-text-secondary)]" />
              <h3 className="text-sm font-medium text-[var(--w-text-primary)]">
                Add Note
              </h3>
            </div>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about this application..."
              rows={3}
              className="text-sm mb-3"
            />
            <Button
              size="sm"
              className="w-full gap-2 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
              disabled={!noteText.trim() || notePending}
              onClick={handleAddNote}
            >
              {notePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" />
              )}
              Add Note
            </Button>
          </div>

          {/* Set Reminder */}
          <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-[var(--w-text-secondary)]" />
              <h3 className="text-sm font-medium text-[var(--w-text-primary)]">
                Follow-up Reminder
              </h3>
            </div>

            {detail.next_step_date && (
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-[var(--w-accent)]/10 rounded-[var(--radius-sm)] border border-[var(--w-accent)]/20">
                <CalendarDays className="h-3.5 w-3.5 text-[var(--w-accent)]" />
                <span className="text-xs text-[var(--w-accent)] font-medium">
                  Reminder: {formatDate(detail.next_step_date)}
                </span>
              </div>
            )}

            <input
              type="date"
              value={reminderDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full h-9 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-3 text-sm text-[var(--w-text-secondary)] mb-3"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-2 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                disabled={reminderPending}
                onClick={handleSetReminder}
              >
                {reminderPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
                {reminderDate ? "Set" : "Clear"}
              </Button>
              {detail.next_step_date && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={reminderPending}
                  onClick={() => {
                    setReminderDate("");
                    startReminderTransition(async () => {
                      const result = await setApplicationReminder(
                        params.id,
                        null
                      );
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success("Reminder cleared");
                        setDetail((d) =>
                          d ? { ...d, next_step_date: null } : d
                        );
                      }
                    });
                  }}
                >
                  <XCircle className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
