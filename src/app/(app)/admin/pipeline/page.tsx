"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getAdminDashboardData,
} from "@/lib/actions/admin";
import type {
  PipelineHealthStats,
  StepStatusCounts,
  FailedJob,
  UserCostRow,
  ValidationFailureRow,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const STEP_LABELS: Record<string, string> = {
  pre_screen: "Pre-Screen",
  evaluate: "Evaluate",
  tailor: "Tailor",
  generate_materials: "Gen. Materials",
  generate_files: "Gen. Files",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[var(--w-primary)]/10 text-[var(--w-primary)]",
  processing: "bg-[var(--w-accent)]/10 text-[var(--w-accent)]",
  completed: "bg-[var(--w-success)]/10 text-[var(--w-success)]",
  failed: "bg-[var(--w-error)]/10 text-[var(--w-error)]",
};

const REFRESH_INTERVAL = 30_000; // 30 seconds

/* ------------------------------------------------------------------ */
/*  Stat Card                                                           */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "warning" | "danger";
}) {
  const borderColor =
    variant === "danger"
      ? "border-[var(--w-error)]/30"
      : variant === "warning"
        ? "border-[var(--w-accent)]/30"
        : "border-[var(--w-border)]";
  const iconColor =
    variant === "danger"
      ? "text-[var(--w-error)]"
      : variant === "warning"
        ? "text-[var(--w-accent)]"
        : "text-[var(--w-primary)]";

  return (
    <div
      className={`rounded-xl border ${borderColor} bg-[var(--w-surface)] p-5`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--w-text-muted)] uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--w-text-primary)]">
            {value}
          </p>
        </div>
        <Icon className={`h-8 w-8 ${iconColor} opacity-50`} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error Log Entry                                                     */
/* ------------------------------------------------------------------ */

function ErrorEntry({ job }: { job: FailedJob }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[var(--w-border)] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-[var(--w-surface-alt)]/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${STATUS_COLORS.failed}`}
            >
              {STEP_LABELS[job.step] ?? job.step}
            </span>
            <span className="text-sm text-[var(--w-text-primary)] truncate">
              {job.error ?? "No error message"}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="text-xs text-[var(--w-text-muted)]">
              x{job.attempts}
            </span>
            <span className="text-xs text-[var(--w-text-muted)]">
              {new Date(job.created_at).toLocaleString()}
            </span>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-[var(--w-text-muted)]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[var(--w-text-muted)]" />
            )}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-4 text-xs text-[var(--w-text-muted)]">
          <span>{job.user_email ?? "Unknown user"}</span>
          {job.job_title && (
            <span>
              {job.job_title}
              {job.company ? ` @ ${job.company}` : ""}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {job.input_data && (
            <div>
              <p className="text-xs font-semibold text-[var(--w-text-secondary)] mb-1">
                Input Data
              </p>
              <pre className="text-xs text-[var(--w-text-muted)] bg-[var(--w-surface-alt)] rounded-md p-3 overflow-x-auto max-h-48">
                {JSON.stringify(job.input_data, null, 2)}
              </pre>
            </div>
          )}
          {job.output_data && (
            <div>
              <p className="text-xs font-semibold text-[var(--w-text-secondary)] mb-1">
                Output Data
              </p>
              <pre className="text-xs text-[var(--w-text-muted)] bg-[var(--w-surface-alt)] rounded-md p-3 overflow-x-auto max-h-48">
                {JSON.stringify(job.output_data, null, 2)}
              </pre>
            </div>
          )}
          {!job.input_data && !job.output_data && (
            <p className="text-xs text-[var(--w-text-muted)] italic">
              No data available for this job.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function AdminPipelinePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [health, setHealth] = useState<PipelineHealthStats | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatusCounts[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [userCosts, setUserCosts] = useState<UserCostRow[]>([]);
  const [validationFailures, setValidationFailures] = useState<
    ValidationFailureRow[]
  >([]);

  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const result = await getAdminDashboardData();
      if ("error" in result) {
        setAuthorized(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAuthorized(true);
      setError(null);
      setHealth(result.health);
      setStepStatus(result.stepStatusCounts);
      setFailedJobs(result.failedJobs);
      setUserCosts(result.userCosts);
      setValidationFailures(result.validationFailures);
      setLastRefresh(new Date());
    } catch {
      if (!isRefresh) setAuthorized(true);
      setError("Failed to load dashboard data. Try refreshing.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // 403 Forbidden
  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--w-bg)]">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-[var(--w-error)] mx-auto" />
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Access Denied
          </h1>
          <p className="text-sm text-[var(--w-text-secondary)]">
            You do not have permission to access the admin dashboard.
          </p>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--w-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--w-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--w-bg)]">
      {/* Error banner */}
      {error && (
        <div className="bg-[var(--w-error)]/10 border-b border-[var(--w-error)]/20 px-6 py-3 text-center text-sm text-[var(--w-error)]">
          {error}
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-[var(--w-border)] bg-[var(--w-surface)] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-[var(--w-primary)]">
              Woodhouse
            </span>
            <span className="text-xs text-[var(--w-text-muted)]">/</span>
            <span className="text-sm font-semibold text-[var(--w-text-primary)]">
              Pipeline Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-[var(--w-text-muted)]">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="h-7"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="h-7">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* ============================================================ */}
        {/*  Pipeline Health                                              */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[var(--w-text-primary)] mb-4">
            Pipeline Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Pending"
              value={health?.pending ?? 0}
              icon={Clock}
            />
            <StatCard
              label="Processing"
              value={health?.processing ?? 0}
              icon={Zap}
              variant={health && health.processing > 10 ? "warning" : "default"}
            />
            <StatCard
              label="Failed (24h)"
              value={health?.failed_24h ?? 0}
              icon={XCircle}
              variant={health && health.failed_24h > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Zombie"
              value={health?.zombie ?? 0}
              icon={AlertTriangle}
              variant={health && health.zombie > 0 ? "danger" : "default"}
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Jobs by Step                                                 */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[var(--w-text-primary)] mb-4">
            Jobs by Step
          </h2>
          <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--w-text-muted)] uppercase tracking-wider border-b border-[var(--w-border)]">
                  <th className="text-left px-4 py-3 font-medium">Step</th>
                  <th className="text-right px-4 py-3 font-medium">Pending</th>
                  <th className="text-right px-4 py-3 font-medium">
                    Processing
                  </th>
                  <th className="text-right px-4 py-3 font-medium">
                    Completed
                  </th>
                  <th className="text-right px-4 py-3 font-medium">Failed</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--w-border)]">
                {stepStatus.map((row) => {
                  const total =
                    row.pending + row.processing + row.completed + row.failed;
                  return (
                    <tr key={row.step} className="text-sm">
                      <td className="px-4 py-3 font-medium text-[var(--w-text-primary)]">
                        {STEP_LABELS[row.step] ?? row.step}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--w-text-secondary)]">
                        {row.pending}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--w-text-secondary)]">
                        {row.processing}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--w-success)]">
                        {row.completed}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          row.failed > 0
                            ? "text-[var(--w-error)] font-semibold"
                            : "text-[var(--w-text-secondary)]"
                        }`}
                      >
                        {row.failed}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--w-text-primary)]">
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Error Log                                                    */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[var(--w-text-primary)] mb-4">
            Error Log
            <span className="ml-2 text-sm font-normal text-[var(--w-text-muted)]">
              ({failedJobs.length} recent failures)
            </span>
          </h2>
          <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden max-h-[500px] overflow-y-auto">
            {failedJobs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--w-text-muted)]">
                No failed jobs found.
              </div>
            ) : (
              failedJobs.map((job) => <ErrorEntry key={job.id} job={job} />)
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Per-User Cost                                                */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[var(--w-text-primary)] mb-4">
            Per-User Cost
            <span className="ml-2 text-sm font-normal text-[var(--w-text-muted)]">
              (last 30 days, top 20)
            </span>
          </h2>
          <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--w-text-muted)] uppercase tracking-wider border-b border-[var(--w-border)]">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-right px-4 py-3 font-medium">Jobs</th>
                  <th className="text-right px-4 py-3 font-medium">In Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">Out Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">
                    Est. Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--w-border)]">
                {userCosts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-[var(--w-text-muted)]"
                    >
                      No usage data available.
                    </td>
                  </tr>
                ) : (
                  userCosts.map((row) => (
                    <tr
                      key={row.profile_id}
                      className={`text-sm ${
                        row.exceeds_revenue
                          ? "bg-[var(--w-error)]/5"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-[var(--w-text-primary)]">
                        {row.email ?? "Unknown"}
                        {row.exceeds_revenue && (
                          <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[var(--w-error)]/10 text-[var(--w-error)]">
                            Cost &gt; Revenue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
                            row.plan === "premium"
                              ? "bg-[var(--w-accent)]/10 text-[var(--w-accent)]"
                              : row.plan === "pro"
                                ? "bg-[var(--w-primary)]/10 text-[var(--w-primary)]"
                                : "bg-[var(--w-surface-alt)] text-[var(--w-text-muted)]"
                          }`}
                        >
                          {row.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--w-text-secondary)]">
                        {row.completed_jobs}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--w-text-secondary)] font-mono text-xs">
                        {row.input_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--w-text-secondary)] font-mono text-xs">
                        {row.output_tokens.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          row.exceeds_revenue
                            ? "text-[var(--w-error)]"
                            : "text-[var(--w-text-primary)]"
                        }`}
                      >
                        ${row.estimated_cost.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Validation Failure Rate                                      */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-lg font-bold text-[var(--w-text-primary)] mb-4">
            Validation Failure Rate
            <span className="ml-2 text-sm font-normal text-[var(--w-text-muted)]">
              (last 7 days)
            </span>
          </h2>
          <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--w-text-muted)] uppercase tracking-wider border-b border-[var(--w-border)]">
                  <th className="text-left px-4 py-3 font-medium">
                    Agent Type
                  </th>
                  <th className="text-right px-4 py-3 font-medium">
                    Total Jobs
                  </th>
                  <th className="text-right px-4 py-3 font-medium">
                    Validation Failures
                  </th>
                  <th className="text-right px-4 py-3 font-medium">
                    Failure Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--w-border)]">
                {validationFailures.map((row) => (
                  <tr key={row.step} className="text-sm">
                    <td className="px-4 py-3 font-medium text-[var(--w-text-primary)]">
                      {STEP_LABELS[row.step] ?? row.step}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--w-text-secondary)]">
                      {row.total}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        row.failed > 0
                          ? "text-[var(--w-error)] font-semibold"
                          : "text-[var(--w-text-secondary)]"
                      }`}
                    >
                      {row.failed}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        row.failure_rate > 1
                          ? "text-[var(--w-error)]"
                          : row.failure_rate > 0
                            ? "text-[var(--w-accent)]"
                            : "text-[var(--w-success)]"
                      }`}
                    >
                      {row.failure_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--w-text-muted)]">
            Target: &lt;1%. Validation failures occur when AI responses fail Zod
            schema validation.
          </p>
        </section>
      </div>
    </div>
  );
}
