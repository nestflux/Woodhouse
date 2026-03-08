"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Briefcase,
  Clock,
  AlertTriangle,
  CreditCard,
  Info,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_ICONS: Record<string, typeof Bell> = {
  new_matches: Briefcase,
  applications_ready: CheckCheck,
  follow_up_reminder: Clock,
  status_stale: AlertTriangle,
  subscription_warning: CreditCard,
  system: Info,
};

const TYPE_COLORS: Record<string, string> = {
  new_matches: "bg-blue-500/10 text-blue-600",
  applications_ready: "bg-emerald-500/10 text-emerald-600",
  follow_up_reminder: "bg-amber-500/10 text-amber-600",
  status_stale: "bg-orange-500/10 text-orange-600",
  subscription_warning: "bg-red-500/10 text-red-600",
  system: "bg-gray-500/10 text-gray-500",
};

type FilterTab = "all" | "unread" | "read";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getNotificationHref(notification: Notification): string | null {
  const meta = notification.metadata;
  if (!meta) return null;

  const appId = meta.application_id as string | undefined;
  if (appId) {
    if (
      notification.type === "applications_ready" ||
      notification.type === "new_matches"
    ) {
      return `/queue/${appId}`;
    }
    return `/tracker/${appId}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function NotificationsSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto animate-pulse">
      <div className="h-7 w-40 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-56 bg-[var(--w-surface-alt)] rounded mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]"
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification Item                                                  */
/* ------------------------------------------------------------------ */

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const router = useRouter();
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  const colorClass = TYPE_COLORS[notification.type] ?? "bg-gray-500/10 text-gray-500";
  const href = getNotificationHref(notification);

  function handleClick() {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (href) {
      router.push(href);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 p-4 rounded-[var(--radius-md)] border text-left transition-colors",
        notification.read
          ? "border-[var(--w-border)] bg-[var(--w-surface)] opacity-70"
          : "border-[var(--w-accent)]/20 bg-[var(--w-accent)]/5 hover:bg-[var(--w-accent)]/10",
        href && "cursor-pointer"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm truncate",
              notification.read
                ? "text-[var(--w-text-secondary)]"
                : "font-medium text-[var(--w-text-primary)]"
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 rounded-full bg-[var(--w-accent)] shrink-0" />
          )}
        </div>
        {notification.body && (
          <p className="text-xs text-[var(--w-text-muted)] mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-[10px] text-[var(--w-text-muted)] mt-1">
          {relativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [markAllPending, startMarkAllTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);

  // Realtime subscription for live updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setTotal((t) => t + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch notifications
  useEffect(() => {
    async function load() {
      setLoading(true);
      const readFilter =
        activeTab === "unread" ? false : activeTab === "read" ? true : undefined;
      const result = await getNotifications(1, readFilter);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setNotifications(result.data.data);
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
      }
      setPage(1);
      setLoading(false);
    }
    load();
  }, [activeTab]);

  async function handleLoadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const readFilter =
      activeTab === "unread" ? false : activeTab === "read" ? true : undefined;
    const result = await getNotifications(nextPage, readFilter);
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setNotifications((prev) => [...prev, ...result.data!.data]);
      setHasMore(result.data.hasMore);
      setPage(nextPage);
    }
    setLoadingMore(false);
  }

  function handleMarkRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    markNotificationRead(id).then((result) => {
      if (result.error) {
        // Rollback
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n))
        );
        toast.error(result.error);
      }
    });
  }

  function handleMarkAllRead() {
    startMarkAllTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) {
        toast.error(result.error);
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast.success("All notifications marked as read");
      }
    });
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) return <NotificationsSkeleton />;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
            {total === 0
              ? "No notifications yet"
              : `${total} notification${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs"
            disabled={markAllPending}
            onClick={handleMarkAllRead}
          >
            {markAllPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)] w-fit">
        {(["all", "unread", "read"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors capitalize",
              activeTab === tab
                ? "bg-[var(--w-surface)] text-[var(--w-text-primary)] shadow-sm"
                : "text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-12 text-center">
          <BellOff className="h-8 w-8 text-[var(--w-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--w-text-secondary)]">
            {activeTab === "unread"
              ? "No unread notifications"
              : activeTab === "read"
                ? "No read notifications"
                : "No notifications yet. They'll appear here when Woodhouse has updates for you."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
            />
          ))}

          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
