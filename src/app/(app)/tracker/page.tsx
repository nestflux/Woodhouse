"use client";

import { useEffect, useState, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import {
  getTrackerApplications,
  getTrackerStats,
  updateTrackerStatus,
  TRACKER_STATUSES,
  type TrackerApplication,
  type TrackerStats,
  type TrackerStatus,
} from "@/lib/actions/applications";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search,
  Inbox,
  Loader2,
  TrendingUp,
  Clock,
  BarChart3,
  Calendar,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLUMN_CONFIG: Record<
  TrackerStatus,
  { label: string; color: string }
> = {
  submitted: { label: "Submitted", color: "var(--w-primary)" },
  acknowledged: { label: "Acknowledged", color: "var(--w-info)" },
  screening: { label: "Screening", color: "var(--w-accent)" },
  interviewing: { label: "Interviewing", color: "var(--w-accent)" },
  offer: { label: "Offer", color: "var(--w-success)" },
  accepted: { label: "Accepted", color: "var(--w-success)" },
  rejected: { label: "Rejected", color: "var(--w-error)" },
  withdrawn: { label: "Withdrawn", color: "var(--w-text-muted)" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--w-success)";
  if (score >= 60) return "var(--w-warning)";
  return "var(--w-error)";
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function daysSinceLabel(dateStr: string): string {
  const days = daysSince(dateStr);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/* ------------------------------------------------------------------ */
/*  Draggable Card                                                     */
/* ------------------------------------------------------------------ */

function TrackerCard({
  app,
  isDragging,
}: {
  app: TrackerApplication;
  isDragging?: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: app.id,
    data: { status: app.status },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow touch-none"
      onClick={() => router.push(`/queue/${app.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--w-text-primary)] truncate">
            {app.companyName}
          </p>
          <p className="text-[11px] text-[var(--w-text-secondary)] truncate mt-0.5">
            {app.jobTitle}
          </p>
        </div>
        {app.overallScore !== null && (
          <span
            className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: getScoreColor(app.overallScore) }}
          >
            {app.overallScore}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--w-text-muted)]">
        {app.submittedAt && (
          <span>
            {new Date(app.submittedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        <span>{daysSinceLabel(app.updatedAt)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overlay Card (shown while dragging)                                */
/* ------------------------------------------------------------------ */

function OverlayCard({ app }: { app: TrackerApplication }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--w-primary)] bg-[var(--w-surface)] p-3 shadow-lg w-56 opacity-90">
      <p className="text-xs font-semibold text-[var(--w-text-primary)] truncate">
        {app.companyName}
      </p>
      <p className="text-[11px] text-[var(--w-text-secondary)] truncate mt-0.5">
        {app.jobTitle}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Droppable Column                                                   */
/* ------------------------------------------------------------------ */

function KanbanColumn({
  status,
  apps,
  activeId,
}: {
  status: TrackerStatus;
  apps: TrackerApplication[];
  activeId: string | null;
}) {
  const config = COLUMN_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[200px] w-56 shrink-0 rounded-[var(--radius-md)] border transition-colors ${
        isOver
          ? "border-[var(--w-primary)] bg-[var(--w-primary)]/5"
          : "border-[var(--w-border)] bg-[var(--w-surface-alt)]"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--w-border)]">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: config.color }}
        />
        <span className="text-xs font-semibold text-[var(--w-text-primary)]">
          {config.label}
        </span>
        <span className="ml-auto text-[10px] font-medium text-[var(--w-text-muted)] bg-[var(--w-surface)] rounded-full px-1.5 py-0.5">
          {apps.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {apps.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <p className="text-[10px] text-[var(--w-text-muted)]">
              No applications
            </p>
          </div>
        ) : (
          apps.map((app) => (
            <TrackerCard
              key={app.id}
              app={app}
              isDragging={activeId === app.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats Bar                                                          */
/* ------------------------------------------------------------------ */

function StatsBar({ stats }: { stats: TrackerStats | null }) {
  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-3 py-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-[var(--w-primary)]" />
        <span className="text-xs text-[var(--w-text-secondary)]">
          In pipeline:{" "}
          <span className="font-semibold text-[var(--w-text-primary)]">
            {stats.totalInPipeline}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-3 py-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-[var(--w-success)]" />
        <span className="text-xs text-[var(--w-text-secondary)]">
          Response rate:{" "}
          <span className="font-semibold text-[var(--w-text-primary)]">
            {Math.round(stats.responseRate * 100)}%
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-3 py-1.5">
        <Clock className="h-3.5 w-3.5 text-[var(--w-accent)]" />
        <span className="text-xs text-[var(--w-text-secondary)]">
          Avg response:{" "}
          <span className="font-semibold text-[var(--w-text-primary)]">
            {stats.avgDaysToResponse !== null
              ? `${stats.avgDaysToResponse} days`
              : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function TrackerSkeleton() {
  return (
    <div className="p-6 md:p-8 animate-pulse">
      <div className="h-8 w-32 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-56 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="flex gap-4 overflow-x-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="min-w-[200px] w-56 h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)] shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function TrackerPage() {
  const [applications, setApplications] = useState<TrackerApplication[]>([]);
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const fetchData = useCallback(async () => {
    const [appsResult, statsResult] = await Promise.all([
      getTrackerApplications(),
      getTrackerStats(),
    ]);

    if (appsResult.data) {
      setApplications(appsResult.data);
    } else if (appsResult.error) {
      toast.error(appsResult.error);
    }

    if (statsResult.data) {
      setStats(statsResult.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Filter by search + date range
  const filtered = applications.filter((a) => {
    if (
      debouncedSearch &&
      !a.companyName.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
      !a.jobTitle.toLowerCase().includes(debouncedSearch.toLowerCase())
    ) {
      return false;
    }
    if (dateFrom && a.submittedAt && a.submittedAt < dateFrom) {
      return false;
    }
    if (dateTo) {
      const toEnd = dateTo + "T23:59:59.999Z";
      if (a.submittedAt && a.submittedAt > toEnd) {
        return false;
      }
    }
    return true;
  });

  // Group by status
  const columns: Record<string, TrackerApplication[]> = {};
  for (const status of TRACKER_STATUSES) {
    columns[status] = [];
  }
  for (const app of filtered) {
    if (columns[app.status]) {
      columns[app.status].push(app);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const appId = active.id as string;
    const newStatus = over.id as string;
    const app = applications.find((a) => a.id === appId);
    if (!app || app.status === newStatus) return;

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
    );

    startTransition(async () => {
      const result = await updateTrackerStatus(appId, newStatus);
      if (result.error) {
        toast.error(result.error);
        // Revert on error
        setApplications((prev) =>
          prev.map((a) =>
            a.id === appId ? { ...a, status: app.status } : a
          )
        );
      } else {
        toast.success(
          `Moved to ${COLUMN_CONFIG[newStatus as TrackerStatus]?.label ?? newStatus}`
        );
        // Refresh stats after status change
        const statsResult = await getTrackerStats();
        if (statsResult.data) {
          setStats(statsResult.data);
        }
      }
    });
  }

  const activeApp = activeId
    ? applications.find((a) => a.id === activeId) ?? null
    : null;

  if (loading) return <TrackerSkeleton />;

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Application Tracker
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Track your submitted applications across all stages.
        </p>
      </div>

      {/* Top Bar: Search + Date Filter + Stats */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--w-text-muted)]" />
            <Input
              placeholder="Search by company or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[var(--w-text-muted)] shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-2 text-xs text-[var(--w-text-secondary)]"
            />
            <span className="text-xs text-[var(--w-text-muted)]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] px-2 text-xs text-[var(--w-text-secondary)]"
            />
          </div>
        </div>
        <StatsBar stats={stats} />
      </div>

      {/* Kanban Board */}
      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="h-12 w-12 text-[var(--w-text-muted)]" />
          <h3 className="mt-4 text-sm font-medium text-[var(--w-text-primary)]">
            No applications tracked yet
          </h3>
          <p className="mt-1 text-sm text-[var(--w-text-muted)] max-w-sm">
            Approve applications from your Review Queue to start tracking.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {TRACKER_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                apps={columns[status]}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeApp ? <OverlayCard app={activeApp} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 rounded-full bg-[var(--w-primary)] p-2 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
