"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from "@/lib/actions/notification-preferences";
import type { NotificationPref } from "@/lib/actions/notification-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Check,
  Key,
  Loader2,
  Mail,
  Save,
  Shield,
  Trash2,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_matches: "New job matches found",
  applications_ready: "Applications ready for review",
  follow_up_reminder: "Follow-up reminders",
  status_stale: "Stale application alerts",
};

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                 */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  danger = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        danger
          ? "border-[var(--w-error)]/30 bg-[var(--w-error)]/5"
          : "border-[var(--w-border)] bg-[var(--w-surface)]"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-[var(--w-surface-alt)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon
            className={`h-4.5 w-4.5 ${
              danger ? "text-[var(--w-error)]" : "text-[var(--w-primary)]"
            }`}
          />
          <span
            className={`text-sm font-semibold ${
              danger ? "text-[var(--w-error)]" : "text-[var(--w-text-primary)]"
            }`}
          >
            {title}
          </span>
        </div>
        {open ? (
          <X className="h-4 w-4 text-[var(--w-text-muted)]" />
        ) : (
          <span className="text-xs text-[var(--w-text-muted)]">Expand</span>
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[var(--w-border)]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                    */
/* ------------------------------------------------------------------ */

function AccountSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-5 h-16"
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function SettingsAccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailPending, startEmailTransition] = useTransition();

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, startPasswordTransition] = useTransition();

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPref[]>([]);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentEmail(user.email);
      }

      const prefs = await getNotificationPreferences();
      setNotifPrefs(prefs);

      setLoading(false);
    }
    load();
  }, []);

  /* ---- Change Email ---- */
  function handleChangeEmail() {
    if (!newEmail.trim()) {
      toast.error("Please enter a new email address");
      return;
    }
    if (newEmail === currentEmail) {
      toast.error("New email is the same as current email");
      return;
    }
    startEmailTransition(async () => {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(
          "Verification email sent to your new address. Check your inbox."
        );
        setNewEmail("");
      }
    });
  }

  /* ---- Change Password ---- */
  function handleChangePassword() {
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    startPasswordTransition(async () => {
      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Current password is incorrect");
        return;
      }

      // Update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  }

  /* ---- Notification Preferences ---- */
  async function handleToggleNotif(
    type: string,
    channel: "in_app" | "email",
    enabled: boolean
  ) {
    // Optimistic update
    setNotifPrefs((prev) =>
      prev.map((p) =>
        p.notification_type === type ? { ...p, [channel]: enabled } : p
      )
    );

    const result = await updateNotificationPreference(type, channel, enabled);
    if (result.error) {
      toast.error(result.error);
      // Revert
      setNotifPrefs((prev) =>
        prev.map((p) =>
          p.notification_type === type ? { ...p, [channel]: !enabled } : p
        )
      );
    }
  }

  /* ---- Delete Account ---- */
  function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }
    startDeleteTransition(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      // Call the delete-account Edge Function which uses the service role
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) {
        // Try to extract the real error from the response body
        const msg =
          (data && typeof data === "object" && "error" in data
            ? (data as { error: string }).error
            : null) ??
          error.message ??
          "Failed to delete account";
        toast.error(msg);
        return;
      }

      await supabase.auth.signOut();
      router.push("/");
    });
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Account
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Manage your account security, notifications, and data.
        </p>
        <div className="mt-8">
          <AccountSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Account
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Manage your account security, notifications, and data.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  Change Email                                                 */}
      {/* ============================================================ */}
      <Section title="Email Address" icon={Mail} defaultOpen>
        <div className="pt-4 space-y-3">
          <div>
            <Label className="text-xs">Current Email</Label>
            <p className="mt-1 text-sm text-[var(--w-text-primary)] font-mono">
              {currentEmail}
            </p>
          </div>
          <div>
            <Label className="text-xs">New Email</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              className="mt-1 text-sm"
            />
            <p className="mt-1 text-[10px] text-[var(--w-text-muted)]">
              A verification link will be sent to your new email address.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={handleChangeEmail}
            disabled={emailPending || !newEmail.trim()}
          >
            {emailPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Mail className="h-3.5 w-3.5 mr-1" />
            )}
            Update Email
          </Button>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Change Password                                              */}
      {/* ============================================================ */}
      <Section title="Password" icon={Key}>
        <div className="pt-4 space-y-3">
          <div>
            <Label className="text-xs">Current Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="mt-1 text-sm"
            />
          </div>
          <Button
            size="sm"
            className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            onClick={handleChangePassword}
            disabled={
              passwordPending || !currentPassword || !newPassword || !confirmPassword
            }
          >
            {passwordPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Shield className="h-3.5 w-3.5 mr-1" />
            )}
            Update Password
          </Button>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Notification Preferences                                     */}
      {/* ============================================================ */}
      <Section title="Notification Preferences" icon={Bell}>
        <div className="pt-4">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--w-text-muted)] uppercase tracking-wider">
                <th className="text-left pb-3 font-medium">Type</th>
                <th className="text-center pb-3 font-medium w-20">In-App</th>
                <th className="text-center pb-3 font-medium w-20">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--w-border)]">
              {notifPrefs.map((pref) => (
                <tr key={pref.notification_type}>
                  <td className="py-3 text-sm text-[var(--w-text-primary)]">
                    {NOTIFICATION_TYPE_LABELS[pref.notification_type] ??
                      pref.notification_type}
                  </td>
                  <td className="py-3 text-center">
                    <button
                      onClick={() =>
                        handleToggleNotif(
                          pref.notification_type,
                          "in_app",
                          !pref.in_app
                        )
                      }
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors ${
                        pref.in_app
                          ? "bg-[var(--w-primary)] text-white"
                          : "border border-[var(--w-border)] text-[var(--w-text-muted)]"
                      }`}
                    >
                      {pref.in_app && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  <td className="py-3 text-center">
                    <button
                      onClick={() =>
                        handleToggleNotif(
                          pref.notification_type,
                          "email",
                          !pref.email
                        )
                      }
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors ${
                        pref.email
                          ? "bg-[var(--w-primary)] text-white"
                          : "border border-[var(--w-border)] text-[var(--w-text-muted)]"
                      }`}
                    >
                      {pref.email && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Danger Zone — Delete Account                                 */}
      {/* ============================================================ */}
      <Section title="Delete Account" icon={AlertTriangle} danger>
        <div className="pt-4 space-y-4">
          <div className="rounded-lg bg-[var(--w-error)]/10 p-4">
            <p className="text-sm font-medium text-[var(--w-error)]">
              This action is permanent and cannot be undone.
            </p>
            <p className="mt-1 text-xs text-[var(--w-text-secondary)]">
              Deleting your account will permanently remove all your data
              including your profile, work experience, skills, education,
              applications, saved jobs, and all AI-generated materials. Your
              subscription will be cancelled immediately.
            </p>
          </div>

          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              size="sm"
              className="border-[var(--w-error)] text-[var(--w-error)] hover:bg-[var(--w-error)]/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              I want to delete my account
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-[var(--w-error)]/30 p-4">
              <p className="text-sm text-[var(--w-text-primary)]">
                Type <strong>DELETE</strong> below to confirm:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="text-sm border-[var(--w-error)]/30"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-[var(--w-error)] text-white hover:bg-[var(--w-error)]/90"
                  onClick={handleDeleteAccount}
                  disabled={deletePending || deleteConfirmText !== "DELETE"}
                >
                  {deletePending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Permanently Delete Account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
