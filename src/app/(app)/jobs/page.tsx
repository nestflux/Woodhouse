"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getJobFeed,
  addJobToQueue,
  type JobFeedItem,
  type JobFeedFilters,
} from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search,
  X,
  Loader2,
  Briefcase,
  Wifi,
  MapPin,
  Eye,
  Plus,
  ArrowUpDown,
  Filter,
  Inbox,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCE_OPTIONS = [
  { value: "", label: "All Sources" },
  { value: "google_jobs", label: "Google Jobs" },
  { value: "jsearch", label: "JSearch" },
  { value: "jsearch_v2", label: "JSearch V2" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "workday", label: "Workday" },
  { value: "manual", label: "Manual" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
];

const SORT_OPTIONS = [
  { value: "score", label: "Match Score" },
  { value: "newest", label: "Newest" },
  { value: "company", label: "Company Name" },
];

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

function formatSource(source: string): string {
  const entry = SOURCE_OPTIONS.find((s) => s.value === source);
  return entry?.label ?? source;
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

/* ------------------------------------------------------------------ */
/*  Score Badge                                                        */
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
/*  Filter Bar                                                         */
/* ------------------------------------------------------------------ */

function FilterBar({
  filters,
  searchInput,
  onSearchInputChange,
  onSearch,
  onChange,
  onClear,
}: {
  filters: JobFeedFilters;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onChange: (f: Partial<JobFeedFilters>) => void;
  onClear: () => void;
}) {
  const hasFilters =
    searchInput ||
    filters.source ||
    filters.status ||
    filters.isRemote !== undefined ||
    filters.country ||
    filters.location ||
    filters.scoreMin !== undefined ||
    filters.scoreMax !== undefined;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-[var(--w-text-muted)]" />
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--w-text-muted)]">
          Filters
        </span>
        {hasFilters && (
          <Button variant="ghost" size="xs" className="ml-auto gap-1" onClick={onClear}>
            <X className="h-3 w-3" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="relative sm:col-span-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--w-text-muted)]" />
            <Input
              placeholder="Search by job title or company..."
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Button variant="default" size="sm" className="h-8 px-3" onClick={onSearch}>
            Search
          </Button>
        </div>

        {/* Source */}
        <select
          value={filters.source ?? ""}
          onChange={(e) => onChange({ source: e.target.value || undefined })}
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-2 text-sm text-[var(--w-text-secondary)]"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value || undefined })}
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-2 text-sm text-[var(--w-text-secondary)]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Score Range */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min score"
            min={0}
            max={100}
            value={filters.scoreMin ?? ""}
            onChange={(e) =>
              onChange({
                scoreMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="h-8 text-sm w-24"
          />
          <span className="text-xs text-[var(--w-text-muted)]">to</span>
          <Input
            type="number"
            placeholder="Max"
            min={0}
            max={100}
            value={filters.scoreMax ?? ""}
            onChange={(e) =>
              onChange({
                scoreMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="h-8 text-sm w-24"
          />
        </div>

        {/* Country */}
        <Input
          placeholder="Country"
          value={filters.country ?? ""}
          onChange={(e) => onChange({ country: e.target.value || undefined })}
          className="h-8 text-sm"
        />

        {/* Location */}
        <Input
          placeholder="Location"
          value={filters.location ?? ""}
          onChange={(e) => onChange({ location: e.target.value || undefined })}
          className="h-8 text-sm"
        />

        {/* Remote Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.isRemote === true}
            onChange={(e) =>
              onChange({ isRemote: e.target.checked ? true : undefined })
            }
            className="h-4 w-4 rounded border-[var(--w-border)]"
          />
          <span className="text-sm text-[var(--w-text-secondary)]">Remote only</span>
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Job Card                                                           */
/* ------------------------------------------------------------------ */

function JobCard({
  job,
  onAddToQueue,
  isPending,
}: {
  job: JobFeedItem;
  onAddToQueue: (jobPostingId: string) => void;
  isPending: boolean;
}) {
  const router = useRouter();
  const score = job.evaluation?.overallScore ?? null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        {job.companyLogoUrl ? (
          <img
            src={job.companyLogoUrl}
            alt={job.companyName}
            className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)] object-contain bg-[var(--w-surface-alt)]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)] bg-[var(--w-surface-alt)] flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-[var(--w-text-muted)]" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--w-text-primary)] truncate">
              {job.companyName}
            </h3>
            {score !== null && <ScoreBadge score={score} />}
          </div>
          <p className="mt-0.5 text-sm text-[var(--w-text-secondary)] truncate">
            {job.jobTitle}
          </p>

          <div className="mt-1.5 flex items-center gap-3 text-xs text-[var(--w-text-muted)] flex-wrap">
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {formatSource(job.source)}
            </Badge>
            <span>{timeAgo(job.postedDate ?? job.discoveredAt)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className="h-7 gap-1 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
          onClick={() => router.push(`/jobs/${job.id}`)}
        >
          <Eye className="h-3.5 w-3.5" />
          View Details
        </Button>
        {job.applicationId ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            onClick={() => router.push(`/queue/${job.applicationId}`)}
          >
            View Application
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            disabled={isPending}
            onClick={() => onAddToQueue(job.id)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add to Queue
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function FeedSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-4xl animate-pulse">
      <div className="h-8 w-32 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-56 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="h-32 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)] mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function JobFeedPage() {
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // Draft filters — user edits these, applied on Search
  const [draftFilters, setDraftFilters] = useState<JobFeedFilters>({ sort: "newest" });
  // Committed filters — actually sent to the server
  const [appliedFilters, setAppliedFilters] = useState<JobFeedFilters>({ sort: "newest" });
  const [searchInput, setSearchInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const fetchJobs = useCallback(
    async (f: JobFeedFilters, pageNum: number, append = false) => {
      setLoading(true);
      const result = await getJobFeed({ ...f, page: pageNum });
      if (result.data) {
        setJobs((prev) => (append ? [...prev, ...result.data!.data] : result.data!.data));
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
      } else if (result.error) {
        toast.error(result.error);
      }
      setLoading(false);
    },
    []
  );

  // Initial load only
  useEffect(() => {
    fetchJobs(appliedFilters, 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(partial: Partial<JobFeedFilters>) {
    setDraftFilters((prev) => ({ ...prev, ...partial }));
  }

  function handleSearch() {
    const committed = { ...draftFilters, search: searchInput || undefined };
    setAppliedFilters(committed);
    setPage(1);
    fetchJobs(committed, 1);
  }

  function handleClearFilters() {
    setSearchInput("");
    const cleared: JobFeedFilters = { sort: draftFilters.sort };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
    fetchJobs(cleared, 1);
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchJobs(appliedFilters, nextPage, true);
  }

  function handleAddToQueue(jobPostingId: string) {
    startTransition(async () => {
      const result = await addJobToQueue(jobPostingId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        toast.success("Job added to queue — tailoring started");
        // Update the local state to show application link
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobPostingId
              ? { ...j, applicationId: result.data!.applicationId }
              : j
          )
        );
      }
    });
  }

  if (loading && jobs.length === 0) return <FeedSkeleton />;

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">Job Feed</h1>
          <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
            {total > 0
              ? `${total} discovered job${total !== 1 ? "s" : ""}`
              : "Discovered jobs will appear here."}
          </p>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-[var(--w-text-muted)]" />
          <select
            value={draftFilters.sort ?? "newest"}
            onChange={(e) =>
              handleFilterChange({
                sort: e.target.value as JobFeedFilters["sort"],
              })
            }
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-2 text-sm text-[var(--w-text-secondary)]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={draftFilters}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearch={handleSearch}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Job List */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-[var(--w-text-muted)]" />
          <h3 className="mt-4 text-sm font-medium text-[var(--w-text-primary)]">
            No jobs found matching your criteria
          </h3>
          <p className="mt-1 text-sm text-[var(--w-text-muted)] max-w-sm">
            Try adjusting your filters or search preferences.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAddToQueue={handleAddToQueue}
              isPending={isPending}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
