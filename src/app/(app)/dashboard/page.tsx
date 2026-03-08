"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getDashboardData,
  type DashboardData,
} from "@/lib/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Inbox,
  TrendingUp,
  Send,
  BarChart3,
  Briefcase,
  Clock,
  Search,
  Zap,
  FileText,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Calendar,
  ArrowRight,
  Users,
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function timeUntil(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = then - now;

  if (diff <= 0) return "Soon";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    created: "Application created",
    materials_generated: "Materials generated",
    approved: "Application approved",
    submitted: "Application submitted",
    response_received: "Response received",
    interview_scheduled: "Interview scheduled",
    interview_completed: "Interview completed",
    offer_received: "Offer received",
    accepted: "Offer accepted",
    rejected: "Application rejected",
    withdrawn: "Application withdrawn",
    note_added: "Note added",
    follow_up_sent: "Follow-up sent",
    status_changed: "Status updated",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function getEventIcon(type: string) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    created: FileText,
    materials_generated: Zap,
    approved: CheckCircle,
    submitted: Send,
    response_received: MessageSquare,
    interview_scheduled: Calendar,
    offer_received: TrendingUp,
    rejected: AlertTriangle,
    status_changed: ArrowRight,
  };
  return map[type] ?? Clock;
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
  progress,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  progress?: { used: number; limit: number };
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--w-text-muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--w-text-muted)]" />
      </div>
      <div className="mt-2 text-2xl font-bold text-[var(--w-text-primary)]">{value}</div>
      {subtitle && (
        <p className="mt-0.5 text-xs text-[var(--w-text-muted)]">{subtitle}</p>
      )}
      {progress && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-[var(--w-surface-alt)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (progress.used / progress.limit) * 100)}%`,
                backgroundColor:
                  progress.used >= progress.limit
                    ? "var(--w-error)"
                    : progress.used >= progress.limit * 0.8
                      ? "var(--w-warning)"
                      : "var(--w-primary)",
              }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--w-text-muted)]">
            {progress.used} of {progress.limit} used
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Match Score Badge                                                  */
/* ------------------------------------------------------------------ */

function ScoreBadge({ score }: { score: number }) {
  const color = getScoreColor(score);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {score}% {getScoreLabel(score)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent Matches                                                     */
/* ------------------------------------------------------------------ */

function RecentMatches({
  matches,
}: {
  matches: DashboardData["recentMatches"];
}) {
  const router = useRouter();

  if (matches.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
        <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-4">
          Recent Matches
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="h-8 w-8 text-[var(--w-text-muted)]" />
          <p className="mt-3 text-sm text-[var(--w-text-muted)]">
            No matches yet. Woodhouse will find jobs matching your profile soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
      <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-4">
        Recent Matches
      </h3>
      <div className="space-y-3">
        {matches.map((match) => (
          <button
            key={match.evaluationId}
            onClick={() => router.push(`/jobs/${match.jobPostingId}`)}
            className="flex items-center gap-3 w-full rounded-[var(--radius-sm)] p-2 text-left transition-colors hover:bg-[var(--w-surface-alt)]"
          >
            {match.companyLogoUrl ? (
              <img
                src={match.companyLogoUrl}
                alt={match.companyName}
                className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)] object-contain bg-[var(--w-surface-alt)]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)] bg-[var(--w-surface-alt)] flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-[var(--w-text-muted)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--w-text-primary)] truncate">
                  {match.companyName}
                </span>
                <ScoreBadge score={match.overallScore} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--w-text-muted)]">
                <span className="truncate">{match.jobTitle}</span>
                <span className="shrink-0">{timeAgo(match.evaluatedAt)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Feed                                                      */
/* ------------------------------------------------------------------ */

function ActivityFeed({
  events,
}: {
  events: DashboardData["recentActivity"];
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
        <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-4">
          Recent Activity
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="h-8 w-8 text-[var(--w-text-muted)]" />
          <p className="mt-3 text-sm text-[var(--w-text-muted)]">
            No activity yet. Your application events will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
      <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-4">
        Recent Activity
      </h3>
      <div className="space-y-3">
        {events.map((event) => {
          const EventIcon = getEventIcon(event.eventType);
          return (
            <div
              key={event.id}
              className="flex items-start gap-3"
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--w-surface-alt)]">
                <EventIcon className="h-3.5 w-3.5 text-[var(--w-text-muted)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--w-text-secondary)]">
                  <span className="font-medium text-[var(--w-text-primary)]">
                    {formatEventType(event.eventType)}
                  </span>
                  {event.companyName && event.jobTitle && (
                    <span>
                      {" "}
                      — {event.jobTitle} at {event.companyName}
                    </span>
                  )}
                </p>
                {event.description && (
                  <p className="mt-0.5 text-xs text-[var(--w-text-muted)]">
                    {event.description}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-[var(--w-text-muted)]">
                  {timeAgo(event.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Discovery Status Card                                              */
/* ------------------------------------------------------------------ */

function DiscoveryStatusCard({
  lastRun,
  nextDiscoveryAt,
}: {
  lastRun: DashboardData["lastDiscoveryRun"];
  nextDiscoveryAt: string | null;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
      <h3 className="text-sm font-semibold text-[var(--w-text-primary)] mb-4">
        Discovery Status
      </h3>
      {lastRun ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--w-text-muted)]">Last scan</span>
            <span className="text-[var(--w-text-secondary)]">
              {lastRun.completedAt ? timeAgo(lastRun.completedAt) : "N/A"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--w-text-muted)]">Jobs found</span>
            <span className="text-[var(--w-text-secondary)]">{lastRun.jobsFound}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--w-text-muted)]">Jobs matched</span>
            <Badge
              variant={lastRun.jobsMatched > 0 ? "default" : "secondary"}
              className="text-xs"
            >
              {lastRun.jobsMatched}
            </Badge>
          </div>
          {nextDiscoveryAt && (
            <div className="flex items-center justify-between text-sm border-t border-[var(--w-border)] pt-3">
              <span className="text-[var(--w-text-muted)]">Next scan</span>
              <span className="text-[var(--w-text-secondary)]">
                {timeUntil(nextDiscoveryAt)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Search className="h-6 w-6 text-[var(--w-text-muted)]" />
          <p className="mt-2 text-sm text-[var(--w-text-muted)]">
            Woodhouse is scanning for jobs matching your profile.
          </p>
          {nextDiscoveryAt && (
            <p className="mt-1 text-xs text-[var(--w-text-muted)]">
              First scan scheduled {timeUntil(nextDiscoveryAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-6xl animate-pulse">
      <div className="h-8 w-48 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-72 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        <div className="h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchDashboard = useCallback(async () => {
    const result = await getDashboardData();
    if (!mountedRef.current) return;
    if (result.data) {
      setData(result.data);
    } else if (result.error) {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchDashboard();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchDashboard]);

  // Realtime subscription for live updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dashboard-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        () => {
          fetchDashboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discovery_runs" },
        () => {
          fetchDashboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboard]);

  if (loading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center p-6">
        <AlertTriangle className="h-12 w-12 text-[var(--w-error)]" />
        <h2 className="mt-4 text-lg font-semibold text-[var(--w-text-primary)]">
          Failed to load dashboard
        </h2>
        <p className="mt-1 text-sm text-[var(--w-text-muted)]">
          Please try refreshing the page.
        </p>
      </div>
    );
  }

  const responseRatePercent = Math.round(data.responseRate * 100);
  const interviewRatePercent = Math.round(data.interviewRate * 100);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Your job search overview at a glance.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard
          label="Applications Ready"
          value={data.queueCount}
          icon={Inbox}
          subtitle={data.queueCount > 0 ? "Waiting for your review" : undefined}
        />
        <StatCard
          label="Used This Month"
          value={`${data.applicationsThisPeriod}/${data.applicationsLimit}`}
          icon={TrendingUp}
          progress={{
            used: data.applicationsThisPeriod,
            limit: data.applicationsLimit,
          }}
        />
        <StatCard
          label="Submitted"
          value={data.totalSubmitted}
          icon={Send}
        />
        <StatCard
          label="Response Rate"
          value={`${responseRatePercent}%`}
          icon={BarChart3}
          subtitle={
            data.totalSubmitted > 0
              ? `Based on ${data.totalSubmitted} submitted`
              : "No submissions yet"
          }
        />
        <StatCard
          label="Interview Rate"
          value={`${interviewRatePercent}%`}
          icon={Users}
          subtitle={
            data.totalSubmitted > 0
              ? `${Math.round(data.interviewRate * data.totalSubmitted)} interviews`
              : "No submissions yet"
          }
        />
      </div>

      {/* Middle + Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <RecentMatches matches={data.recentMatches} />
          <ActivityFeed events={data.recentActivity} />
        </div>
        <div>
          <DiscoveryStatusCard
            lastRun={data.lastDiscoveryRun}
            nextDiscoveryAt={data.nextDiscoveryAt}
          />
        </div>
      </div>
    </div>
  );
}
