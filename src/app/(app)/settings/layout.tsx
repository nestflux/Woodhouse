"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/subscription", label: "Subscription" },
  { href: "/settings/account", label: "Account" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b border-[var(--w-border)] bg-[var(--w-surface)]">
        <div className="max-w-3xl mx-auto px-8">
          <nav className="flex gap-6 -mb-px">
            {SETTINGS_TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-[var(--w-primary)] text-[var(--w-primary)]"
                      : "border-transparent text-[var(--w-text-muted)] hover:text-[var(--w-text-secondary)] hover:border-[var(--w-border)]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
