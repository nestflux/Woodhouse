"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCount } from "@/lib/actions/notifications";
import {
  LayoutDashboard,
  Briefcase,
  ClipboardCheck,
  KanbanSquare,
  PlusCircle,
  Bell,
  Settings,
  User,
  SlidersHorizontal,
  CreditCard,
  Shield,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string; icon: React.ElementType }[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Job Feed", href: "/jobs", icon: Briefcase },
  { label: "Review Queue", href: "/queue", icon: ClipboardCheck },
  { label: "Tracker", href: "/tracker", icon: KanbanSquare },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Add Job", href: "/jobs/add", icon: PlusCircle },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { label: "Profile", href: "/settings/profile", icon: User },
      {
        label: "Preferences",
        href: "/settings/preferences",
        icon: SlidersHorizontal,
      },
      {
        label: "Subscription",
        href: "/settings/subscription",
        icon: CreditCard,
      },
      { label: "Account", href: "/settings/account", icon: Shield },
    ],
  },
];

interface AppSidebarProps {
  userEmail: string;
  userName: string;
}

export function AppSidebar({ userEmail, userName }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/settings")
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);

  // Fetch unread notification count + subscribe to Realtime
  useEffect(() => {
    getUnreadCount().then((result) => {
      if (result.data !== undefined) setUnreadCount(result.data);
    });

    const supabase = createClient();
    const channel = supabase
      .channel("sidebar-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          // Re-fetch count on any change to notifications
          getUnreadCount().then((result) => {
            if (result.data !== undefined) setUnreadCount(result.data);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Close mobile overlay on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMobileMenu();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMobileMenu]);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Sign out intent is clear — navigate regardless
    }
    router.push("/signin");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    // /jobs/add should not activate "Job Feed" (/jobs)
    if (href === "/jobs")
      return (
        pathname === "/jobs" ||
        (pathname.startsWith("/jobs/") && !pathname.startsWith("/jobs/add"))
      );
    if (href === "/jobs/add") return pathname.startsWith("/jobs/add");
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[var(--w-border)] px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-[var(--w-primary)]">
            Woodhouse
          </h1>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            if (item.children) {
              const settingsActive = pathname.startsWith("/settings");
              return (
                <li key={item.href}>
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    title={item.label}
                    aria-label={item.label}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      settingsActive
                        ? "bg-[var(--w-primary)] text-white"
                        : "text-[var(--w-text-secondary)] hover:bg-[var(--w-surface)]"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="sidebar-label flex-1 text-left">
                      {item.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "sidebar-label h-4 w-4 transition-transform",
                        settingsOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {settingsOpen && (
                    <ul className="mt-1 flex flex-col gap-1 pl-4">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            title={child.label}
                            aria-label={child.label}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                              isActive(child.href)
                                ? "bg-[var(--w-primary)] text-white"
                                : "text-[var(--w-text-secondary)] hover:bg-[var(--w-surface)]"
                            )}
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span className="sidebar-label">{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            const isNotifications = item.href === "/notifications";

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-[var(--w-primary)] text-white"
                      : "text-[var(--w-text-secondary)] hover:bg-[var(--w-surface)]"
                  )}
                >
                  <span className="relative shrink-0">
                    <item.icon className="h-5 w-5" />
                    {isNotifications && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--w-accent)] px-1 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="sidebar-label flex-1">{item.label}</span>
                  {isNotifications && unreadCount > 0 && (
                    <span className="sidebar-label text-[10px] font-bold text-[var(--w-accent)]">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Menu */}
      <div className="border-t border-[var(--w-border)] px-3 py-4">
        <div className="mb-2 flex items-center gap-3 px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--w-primary)] text-xs font-medium text-white">
            {userName
              ? userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "?"}
          </div>
          <div className="sidebar-label min-w-0">
            <p className="truncate text-sm font-medium text-[var(--w-text-primary)]">
              {userName || "User"}
            </p>
            <p className="truncate text-xs text-[var(--w-text-muted)]">
              {userEmail}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          title="Sign Out"
          aria-label="Sign Out"
          className="w-full justify-start gap-3 px-3 text-sm text-[var(--w-text-secondary)] hover:bg-[var(--w-surface)]"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="sidebar-label">Sign Out</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden h-screen flex-col border-r border-[var(--w-border)] bg-w-surface-alt md:flex md:w-16 xl:w-60">
        {sidebarContent}
      </aside>

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--w-border)] bg-[var(--w-surface)] md:hidden">
        <nav className="flex items-center justify-around py-2">
          {navItems.slice(0, 5).map((item) => {
            const isBell = item.href === "/notifications";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1 text-xs",
                  isActive(item.href)
                    ? "text-[var(--w-primary)]"
                    : "text-[var(--w-text-muted)]"
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {isBell && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--w-accent)] px-0.5 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="More options"
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1 text-xs",
              mobileOpen
                ? "text-[var(--w-primary)]"
                : "text-[var(--w-text-muted)]"
            )}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span>More</span>
          </button>
        </nav>
      </div>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileMenu}
          />
          <div className="absolute right-0 bottom-16 left-0 flex flex-col bg-[var(--w-surface-alt)] p-4">
            <Link
              href="/settings"
              onClick={closeMobileMenu}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium",
                pathname.startsWith("/settings")
                  ? "bg-[var(--w-primary)] text-white"
                  : "text-[var(--w-text-secondary)]"
              )}
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-[var(--w-text-secondary)]"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
