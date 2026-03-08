"use client";

import { useEffect, useState, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getQueueApplications,
  skipApplication,
  saveApplicationForLater,
  moveToReady,
  quickApproveApplication,
  type QueueApplication,
} from "@/lib/actions/applications";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  Eye,
  SkipForward,
  BookmarkPlus,
  ArrowRight,
  Inbox,
  Loader2,
  MapPin,
  Wifi,
} from "lucide-react";

type TabStatus = "ready" | "saved" | "skipped";

const TAB_CONFIG: Array<{ value: TabStatus; label: string }> = [
  { value: "ready", label: "Ready" },
  { value: "saved", label: "Saved for Later" },
  { value: "skipped", label: "Skipped" },
];

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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function MatchScoreBadge({ score }: { score: number }) {
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

function ApplicationCard({
  app,
  activeTab,
  onAction,
  isPending,
}: {
  app: QueueApplication;
  activeTab: TabStatus;
  onAction: (id: string, action: string) => void;
  isPending: boolean;
}) {
  const router = useRouter();
  const score = app.job_evaluations?.overall_score ?? 0;
  const posting = app.job_postings;
  const tailoringNotes =
    app.resume_versions?.[0]?.tailoring_notes ?? null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--w-text-primary)] truncate">
              {posting.company_name}
            </h3>
            <MatchScoreBadge score={score} />
          </div>
          <p className="mt-0.5 text-sm text-[var(--w-text-secondary)] truncate">
            {posting.job_title}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--w-text-muted)]">
            {(posting.location || posting.is_remote) && (
              <span className="flex items-center gap-1">
                {posting.is_remote ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    Remote
                  </>
                ) : (
                  <>
                    <MapPin className="h-3 w-3" />
                    {posting.location}
                  </>
                )}
              </span>
            )}
            <span>Prepared {timeAgo(app.updated_at)}</span>
          </div>
          {tailoringNotes && (
            <p className="mt-2 text-xs text-[var(--w-text-muted)] line-clamp-1">
              {tailoringNotes}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Button
          variant="default"
          size="sm"
          className="h-7 gap-1 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
          onClick={() => router.push(`/queue/${app.id}`)}
        >
          <Eye className="h-3.5 w-3.5" />
          Review
        </Button>

        {activeTab === "ready" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-[var(--w-success)] text-[var(--w-success)] hover:bg-[var(--w-success)]/10"
              disabled={isPending}
              onClick={() => onAction(app.id, "approve")}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Quick Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)]"
              disabled={isPending}
              onClick={() => onAction(app.id, "save")}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save for Later
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)]"
              disabled={isPending}
              onClick={() => onAction(app.id, "skip")}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </Button>
          </>
        )}

        {activeTab === "saved" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            disabled={isPending}
            onClick={() => onAction(app.id, "moveToReady")}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Move to Ready
          </Button>
        )}

        {activeTab === "skipped" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            disabled={isPending}
            onClick={() => onAction(app.id, "moveToReady")}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Restore
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabStatus }) {
  const messages: Record<TabStatus, { title: string; desc: string }> = {
    ready: {
      title: "No applications waiting for review",
      desc: "Woodhouse will prepare new applications as matching jobs are discovered.",
    },
    saved: {
      title: "No saved applications",
      desc: "Applications you save for later will appear here.",
    },
    skipped: {
      title: "No skipped applications",
      desc: "Applications you skip will appear here for future reference.",
    },
  };

  const msg = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="h-12 w-12 text-[var(--w-text-muted)]" />
      <h3 className="mt-4 text-sm font-medium text-[var(--w-text-primary)]">
        {msg.title}
      </h3>
      <p className="mt-1 text-sm text-[var(--w-text-muted)] max-w-sm">
        {msg.desc}
      </p>
    </div>
  );
}

export default function ReviewQueuePage() {
  const [activeTab, setActiveTab] = useState<TabStatus>("ready");
  const [applications, setApplications] = useState<QueueApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const activeTabRef = useRef<TabStatus>(activeTab);

  // Keep ref in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const fetchApplications = useCallback(
    async (status: TabStatus, pageNum: number, append = false) => {
      setLoading(true);
      const result = await getQueueApplications(status, pageNum);
      if (result.data) {
        setApplications((prev) =>
          append ? [...prev, ...result.data!.data] : result.data!.data
        );
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
      } else if (result.error) {
        toast.error(result.error);
      }
      setLoading(false);
    },
    []
  );

  // Initial load and tab change
  useEffect(() => {
    setPage(1);
    fetchApplications(activeTab, 1);
  }, [activeTab, fetchApplications]);

  // Supabase Realtime subscription — single channel, stable across tab changes
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("queue-applications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            fetchApplications(activeTabRef.current, 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchApplications]);

  function handleAction(applicationId: string, action: string) {
    startTransition(async () => {
      let result: { error?: string };

      switch (action) {
        case "approve":
          result = await quickApproveApplication(applicationId);
          if (!result.error) {
            toast.success("Application approved");
            setApplications((prev) =>
              prev.filter((a) => a.id !== applicationId)
            );
            setTotal((t) => Math.max(0, t - 1));
          }
          break;
        case "skip":
          result = await skipApplication(applicationId);
          if (!result.error) {
            toast.success("Application skipped");
            setApplications((prev) =>
              prev.filter((a) => a.id !== applicationId)
            );
            setTotal((t) => Math.max(0, t - 1));
          }
          break;
        case "save":
          result = await saveApplicationForLater(applicationId);
          if (!result.error) {
            toast.success("Saved for later");
            setApplications((prev) =>
              prev.filter((a) => a.id !== applicationId)
            );
            setTotal((t) => Math.max(0, t - 1));
          }
          break;
        case "moveToReady":
          result = await moveToReady(applicationId);
          if (!result.error) {
            toast.success("Moved to Ready");
            setApplications((prev) =>
              prev.filter((a) => a.id !== applicationId)
            );
            setTotal((t) => Math.max(0, t - 1));
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

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchApplications(activeTab, nextPage, true);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Review Queue
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Review and approve your prepared applications.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabStatus)}
      >
        <TabsList variant="line" className="mb-4">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.value === activeTab && total > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px]"
                >
                  {total}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_CONFIG.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {loading && applications.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--w-text-muted)]" />
              </div>
            ) : applications.length === 0 ? (
              <EmptyState tab={tab.value} />
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    activeTab={activeTab}
                    onAction={handleAction}
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
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
