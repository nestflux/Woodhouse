"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  checkIsAdmin,
  getTailoringConfig,
  setTailoringConfig,
  type TailoringPromptMode,
} from "@/lib/actions/system-config";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Shield,
  Settings,
  Save,
  ShieldAlert,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mode Options                                                       */
/* ------------------------------------------------------------------ */

const MODE_OPTIONS: {
  value: TailoringPromptMode;
  label: string;
  description: string;
}[] = [
  {
    value: "system_default",
    label: "System Default",
    description:
      "Use the built-in tailoring rules only. No custom instructions from admin or users.",
  },
  {
    value: "admin_custom",
    label: "Admin Custom",
    description:
      "Append your custom instructions to the base prompt. Users cannot customize.",
  },
  {
    value: "user_choice",
    label: "User Choice",
    description:
      "Allow users to provide their own tailoring instructions. You can optionally set base instructions that apply to all users.",
  },
];

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function AdminSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-3xl animate-pulse">
      <div className="h-8 w-24 bg-[var(--w-surface-alt)] rounded mb-6" />
      <div className="h-6 w-48 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-72 bg-[var(--w-surface-alt)] rounded mb-8" />
      <div className="h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function AdminSettingsPage() {
  const router = useRouter();
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [mode, setMode] = useState<TailoringPromptMode>("system_default");
  const [adminText, setAdminText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Track original values to detect changes
  const [originalMode, setOriginalMode] =
    useState<TailoringPromptMode>("system_default");
  const [originalAdminText, setOriginalAdminText] = useState("");

  useEffect(() => {
    async function load() {
      const [adminResult, configResult] = await Promise.all([
        checkIsAdmin(),
        getTailoringConfig(),
      ]);

      if (adminResult.error || !adminResult.data) {
        setIsAdminUser(false);
        setLoading(false);
        return;
      }

      setIsAdminUser(true);

      if (configResult.data) {
        setMode(configResult.data.mode);
        setOriginalMode(configResult.data.mode);
        const text = configResult.data.adminText ?? "";
        setAdminText(text);
        setOriginalAdminText(text);
      }

      setLoading(false);
    }
    load();
  }, []);

  const hasChanges = mode !== originalMode || adminText !== originalAdminText;

  function handleSave() {
    startTransition(async () => {
      const result = await setTailoringConfig(
        mode,
        adminText.trim() || null
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Tailoring configuration saved");
        setOriginalMode(mode);
        setOriginalAdminText(adminText);
      }
    });
  }

  if (loading) return <AdminSkeleton />;

  if (!isAdminUser) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <ShieldAlert className="h-12 w-12 text-[var(--w-error)]" />
        <h2 className="mt-4 text-lg font-semibold text-[var(--w-text-primary)]">
          Access Denied
        </h2>
        <p className="mt-1 text-sm text-[var(--w-text-muted)]">
          You don&apos;t have admin access to this page.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1 text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)]"
        onClick={() => router.push("/dashboard")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--w-primary)] flex items-center justify-center">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--w-text-primary)]">
            Admin Settings
          </h1>
          <p className="text-sm text-[var(--w-text-secondary)]">
            Configure system-wide tailoring behavior
          </p>
        </div>
      </div>

      {/* Tailoring Prompt Configuration */}
      <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-[var(--w-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--w-text-primary)]">
            Tailoring Prompt Mode
          </h2>
        </div>

        <p className="text-xs text-[var(--w-text-muted)] mb-4">
          Controls how the AI tailors resumes. The base safety rules
          (truthfulness, no fabrication, output format) are always enforced
          regardless of mode.
        </p>

        {/* Mode Selection */}
        <div className="space-y-3 mb-6">
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 rounded-[var(--radius-md)] border p-4 cursor-pointer transition-colors ${
                mode === option.value
                  ? "border-[var(--w-primary)] bg-[var(--w-primary)]/5"
                  : "border-[var(--w-border)] hover:border-[var(--w-text-muted)]"
              }`}
            >
              <input
                type="radio"
                name="tailoring-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="mt-0.5 h-4 w-4 accent-[var(--w-primary)]"
              />
              <div>
                <span className="text-sm font-medium text-[var(--w-text-primary)]">
                  {option.label}
                </span>
                <p className="mt-0.5 text-xs text-[var(--w-text-muted)]">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Admin Instructions Textarea */}
        {(mode === "admin_custom" || mode === "user_choice") && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--w-text-primary)] mb-1.5">
              {mode === "admin_custom"
                ? "Admin Instructions"
                : "Admin Base Instructions (optional)"}
            </label>
            <p className="text-xs text-[var(--w-text-muted)] mb-2">
              {mode === "admin_custom"
                ? "These instructions are appended to the base prompt for all users."
                : "These base instructions apply to all users. Users can add their own on top."}
            </p>
            <Textarea
              value={adminText}
              onChange={(e) => setAdminText(e.target.value)}
              placeholder="e.g., Always lead with quantified impact metrics. Prioritize technical achievements over soft skills."
              rows={5}
              className="text-sm"
            />
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--w-border)]">
          <p className="text-xs text-[var(--w-text-muted)]">
            {hasChanges
              ? "You have unsaved changes"
              : "Configuration is up to date"}
          </p>
          <Button
            className="gap-2 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
            disabled={!hasChanges || isPending}
            onClick={handleSave}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
