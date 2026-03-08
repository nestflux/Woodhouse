"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  getSearchPreferences,
  upsertSearchPreferences,
  updateProfilePreferences,
} from "@/lib/actions/search-preferences";
import { getProfile, updateEmailDigest } from "@/lib/actions/profile";
import {
  getTrackedBoards,
  createTrackedBoard,
  deleteTrackedBoard,
} from "@/lib/actions/tracked-boards";
import { getForwardingAddress } from "@/lib/actions/forwarding-address";
import { checkSubscription } from "@/lib/subscription";
import {
  getTailoringConfig,
  getTailoringInstructions,
  setTailoringInstructions,
} from "@/lib/actions/system-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
  FileText,
  Clock,
  Globe,
} from "lucide-react";
import type { SubscriptionFeatures } from "@/lib/subscription";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const REMOTE_OPTIONS = [
  { value: "remote_only", label: "Remote Only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
  { value: "flexible", label: "Flexible" },
];

const JOB_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
];

const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "INR", "BRL", "SGD",
];

const SCAN_FREQUENCY: Record<string, string> = {
  free: "Every 12 hours",
  pro: "Every 6 hours",
  premium: "Every hour",
};

const TAILORING_TEMPLATES = [
  { value: "", label: "Start from scratch", text: "" },
  {
    value: "technical",
    label: "Technical depth",
    text: "Prioritize technical skills, frameworks, and architecture decisions. Highlight system design work and engineering complexity. Lead with specific technologies and quantified technical outcomes over people management.",
  },
  {
    value: "leadership",
    label: "Leadership focus",
    text: "Emphasize team leadership, cross-functional collaboration, and strategic decision-making. Lead with scope of impact — team size, budget responsibility, organizational influence. Highlight mentorship and process improvements.",
  },
  {
    value: "metrics",
    label: "Metrics-driven",
    text: "Lead every achievement bullet with a quantified result. Prioritize revenue impact, cost savings, performance improvements, and measurable business outcomes. Use specific numbers, percentages, and dollar amounts wherever available.",
  },
  {
    value: "concise",
    label: "Concise",
    text: "Keep the resume tight — 2-3 positions max, 3 bullets each. Only include what is directly relevant to the target role. Cut anything that doesn't strengthen the application. Prefer brevity over comprehensiveness.",
  },
  {
    value: "career_changer",
    label: "Career changer",
    text: "Highlight transferable skills and relevant adjacent experience. De-emphasize industry-specific jargon from the previous field. Frame past experience in terms that resonate with the target role. Emphasize adaptability and learning speed.",
  },
];

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface TrackedBoard {
  id: string;
  platform: string;
  board_url: string;
  company_name: string;
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                 */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-[var(--w-surface-alt)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4.5 w-4.5 text-[var(--w-primary)]" />
          <span className="text-sm font-semibold text-[var(--w-text-primary)]">
            {title}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[var(--w-text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--w-text-muted)]" />
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
/*  Tag Input                                                           */
/* ------------------------------------------------------------------ */

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = input.trim();
      if (value && !values.includes(value)) {
        onChange([...values, value]);
      }
      setInput("");
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 px-2 py-1 text-xs">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="text-sm"
      />
      <p className="text-[10px] text-[var(--w-text-muted)]">
        Press Enter or comma to add
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                    */
/* ------------------------------------------------------------------ */

function PreferencesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
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

export default function SettingsPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<SubscriptionFeatures | null>(null);

  // Search preferences state
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [remotePreference, setRemotePreference] = useState("flexible");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [matchThreshold, setMatchThreshold] = useState(70);
  const [jobTypes, setJobTypes] = useState<string[]>(["full_time"]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>([]);
  const [preferredCompanySizes, setPreferredCompanySizes] = useState<string[]>([]);

  // Email forwarding
  const [forwardingAddress, setForwardingAddress] = useState<string | null>(null);
  const [forwardingGated, setForwardingGated] = useState(false);

  // Tracked boards
  const [boards, setBoards] = useState<TrackedBoard[]>([]);
  const [newBoardPlatform, setNewBoardPlatform] = useState("greenhouse");
  const [newBoardUrl, setNewBoardUrl] = useState("");
  const [newBoardCompany, setNewBoardCompany] = useState("");
  const [addingBoard, setAddingBoard] = useState(false);

  // Email digest
  const [emailDigest, setEmailDigest] = useState<"none" | "daily" | "weekly">("daily");

  // Tailoring instructions
  const [userChoiceEnabled, setUserChoiceEnabled] = useState(false);
  const [tailoringInstructions, setTailoringInstructionsState] = useState("");
  const [originalTailoringInstructions, setOriginalTailoringInstructions] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const [savePending, startSaveTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const [profile, prefs, boardList, fwd, sub, tailConfig, tailInstructions] =
        await Promise.all([
          getProfile(),
          getSearchPreferences(),
          getTrackedBoards(),
          getForwardingAddress(),
          checkSubscription(),
          getTailoringConfig(),
          getTailoringInstructions(),
        ]);

      if (sub.data) setFeatures(sub.data);

      if (profile) {
        setTargetRoles(profile.target_roles ?? []);
        setTargetCountries(profile.target_countries ?? []);
        setTargetLocations(profile.target_locations ?? []);
        setRemotePreference(profile.remote_preference ?? "flexible");
        setMinSalary(profile.min_salary?.toString() ?? "");
        setMaxSalary(profile.max_salary?.toString() ?? "");
        setSalaryCurrency(profile.salary_currency ?? "USD");
        setMatchThreshold(profile.match_threshold ?? 70);
        setEmailDigest((profile.email_digest as "none" | "daily" | "weekly") ?? "daily");
      }

      if (prefs) {
        setKeywords(prefs.keywords ?? []);
        setExcludedKeywords(prefs.excluded_keywords ?? []);
        setExcludedCompanies(prefs.excluded_companies ?? []);
        setPreferredIndustries(prefs.preferred_industries ?? []);
        setPreferredCompanySizes(prefs.preferred_company_sizes ?? []);
        setJobTypes(prefs.job_types ?? ["full_time"]);
      }

      setBoards(boardList as TrackedBoard[]);

      if (fwd.data) {
        setForwardingAddress(fwd.data);
      } else if (fwd.gated) {
        setForwardingGated(true);
      }

      if (tailConfig.data) {
        setUserChoiceEnabled(tailConfig.data.userInstructionsEnabled);
      }
      if (tailInstructions.data) {
        setTailoringInstructionsState(tailInstructions.data);
        setOriginalTailoringInstructions(tailInstructions.data);
        const matched = TAILORING_TEMPLATES.find((t) => t.text === tailInstructions.data);
        if (matched) setSelectedTemplate(matched.value);
      }

      setLoading(false);
    }
    load();
  }, []);

  /* ---- Handlers ---- */

  function handleSaveSearchPrefs() {
    startSaveTransition(async () => {
      const profileResult = await updateProfilePreferences({
        target_roles: targetRoles,
        target_locations: targetLocations,
        target_countries: targetCountries,
        remote_preference: remotePreference,
        min_salary: minSalary ? parseInt(minSalary) : null,
        max_salary: maxSalary ? parseInt(maxSalary) : null,
        salary_currency: salaryCurrency,
        match_threshold: matchThreshold,
      });
      if (profileResult.error) {
        toast.error(profileResult.error);
        return;
      }

      const prefsResult = await upsertSearchPreferences({
        keywords,
        excluded_keywords: excludedKeywords,
        excluded_companies: excludedCompanies,
        preferred_industries: preferredIndustries,
        preferred_company_sizes: preferredCompanySizes,
        min_salary: minSalary ? parseInt(minSalary) : null,
        max_salary: maxSalary ? parseInt(maxSalary) : null,
        salary_currency: salaryCurrency,
        job_types: jobTypes,
      });
      if (prefsResult.error) {
        toast.error(prefsResult.error);
        return;
      }

      toast.success("Search preferences saved");
    });
  }

  async function handleAddBoard() {
    if (!newBoardUrl.trim() || !newBoardCompany.trim()) {
      toast.error("Board URL and company name are required");
      return;
    }
    setAddingBoard(true);
    const result = await createTrackedBoard({
      platform: newBoardPlatform,
      board_url: newBoardUrl.trim(),
      company_name: newBoardCompany.trim(),
    });
    setAddingBoard(false);
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setBoards((prev) => [result.data as TrackedBoard, ...prev]);
      setNewBoardUrl("");
      setNewBoardCompany("");
      toast.success("Board added");
    }
  }

  async function handleDeleteBoard(id: string) {
    const result = await deleteTrackedBoard(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setBoards((prev) => prev.filter((b) => b.id !== id));
      toast.success("Board removed");
    }
  }

  function handleCopyAddress() {
    if (forwardingAddress) {
      try {
        navigator.clipboard.writeText(forwardingAddress);
        toast.success("Forwarding address copied");
      } catch {
        toast.error("Failed to copy — please copy manually");
      }
    }
  }

  function handleEmailDigestChange(value: string) {
    const v = value as "none" | "daily" | "weekly";
    setEmailDigest(v);
    startSaveTransition(async () => {
      const result = await updateEmailDigest(v);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Email digest preference updated");
      }
    });
  }

  function handleTemplateChange(value: string) {
    setSelectedTemplate(value);
    const template = TAILORING_TEMPLATES.find((t) => t.value === value);
    if (template) {
      setTailoringInstructionsState(template.text);
    }
  }

  function handleSaveTailoring() {
    startSaveTransition(async () => {
      const result = await setTailoringInstructions(
        tailoringInstructions.trim() || null
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Tailoring preferences saved");
        setOriginalTailoringInstructions(tailoringInstructions);
      }
    });
  }

  function toggleJobType(value: string) {
    setJobTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function getThresholdLabel(value: number): string {
    if (value <= 50) return "Cast a wide net";
    if (value <= 70) return "Balanced";
    return "Only strong matches";
  }

  const tailoringHasChanges = tailoringInstructions !== originalTailoringInstructions;
  const plan = features?.plan ?? "free";

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Preferences
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Configure your job search criteria and notification settings.
        </p>
        <div className="mt-8">
          <PreferencesSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Preferences
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Configure your job search criteria and notification settings.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  Search Preferences                                           */}
      {/* ============================================================ */}
      <Section title="Search Preferences" icon={Search} defaultOpen>
        <div className="grid gap-5 pt-4">
          <TagInput
            label="Target Role Titles"
            values={targetRoles}
            onChange={setTargetRoles}
            placeholder="e.g., Senior Software Engineer, Staff Engineer"
          />

          <TagInput
            label="Target Countries"
            values={targetCountries}
            onChange={setTargetCountries}
            placeholder="e.g., United States, Canada, United Kingdom"
          />

          <TagInput
            label="Target Locations"
            values={targetLocations}
            onChange={setTargetLocations}
            placeholder="e.g., San Francisco, New York, Remote"
          />

          <div className="grid gap-1.5">
            <Label className="text-xs">Remote Preference</Label>
            <Select
              value={remotePreference}
              onValueChange={(v) => v && setRemotePreference(v)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMOTE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Min Salary</Label>
              <Input
                type="number"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
                placeholder="80000"
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Max Salary</Label>
              <Input
                type="number"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
                placeholder="150000"
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Currency</Label>
              <Select
                value={salaryCurrency}
                onValueChange={(v) => v && setSalaryCurrency(v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Job Types</Label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((jt) => (
                <Badge
                  key={jt.value}
                  variant={jobTypes.includes(jt.value) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-xs"
                  onClick={() => toggleJobType(jt.value)}
                >
                  {jobTypes.includes(jt.value) && (
                    <Check className="mr-1 h-3 w-3" />
                  )}
                  {jt.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Match Threshold</Label>
              <span className="text-xs font-medium text-[var(--w-primary)]">
                {matchThreshold}%
              </span>
            </div>
            <Slider
              value={[matchThreshold]}
              onValueChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                setMatchThreshold(v);
              }}
              min={0}
              max={100}
              step={5}
            />
            <div className="flex justify-between text-[10px] text-[var(--w-text-muted)]">
              <span>50 — Wide net</span>
              <span>70 — Balanced</span>
              <span>90 — Strong only</span>
            </div>
            <p className="text-xs text-[var(--w-text-secondary)]">
              Current: {getThresholdLabel(matchThreshold)}. Jobs scoring above
              this threshold will automatically have applications prepared.
            </p>
          </div>

          <TagInput
            label="Search Keywords"
            values={keywords}
            onChange={setKeywords}
            placeholder="e.g., React, machine learning, fintech"
          />

          <TagInput
            label="Excluded Keywords"
            values={excludedKeywords}
            onChange={setExcludedKeywords}
            placeholder="e.g., intern, clearance required"
          />

          <TagInput
            label="Excluded Companies"
            values={excludedCompanies}
            onChange={setExcludedCompanies}
            placeholder="e.g., Company I don't want to apply to"
          />

          <TagInput
            label="Preferred Industries (optional)"
            values={preferredIndustries}
            onChange={setPreferredIndustries}
            placeholder="e.g., Technology, Finance, Healthcare"
          />

          <TagInput
            label="Preferred Company Sizes (optional)"
            values={preferredCompanySizes}
            onChange={setPreferredCompanySizes}
            placeholder="e.g., Startup, Mid-size, Enterprise"
          />

          <div className="pt-2">
            <Button
              size="sm"
              className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
              onClick={handleSaveSearchPrefs}
              disabled={savePending}
            >
              {savePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Save Search Preferences
            </Button>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Email Forwarding                                             */}
      {/* ============================================================ */}
      <Section title="Email Forwarding" icon={Mail}>
        <div className="pt-4">
          {forwardingGated ? (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--w-border)] bg-[var(--w-surface-alt)] p-4">
              <Crown className="h-5 w-5 text-[var(--w-accent)] shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--w-text-primary)]">
                  Email forwarding is available on Pro and Premium plans
                </p>
                <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
                  Forward job confirmation emails to Woodhouse to auto-track applications.
                </p>
              </div>
              <Link href="/settings/subscription">
                <Button size="sm" variant="outline" className="text-xs">
                  Upgrade
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          ) : forwardingAddress ? (
            <div>
              <p className="text-xs text-[var(--w-text-muted)] mb-2">
                Forward job-related emails to this address to auto-import them into your tracker.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-[var(--w-border)] bg-[var(--w-surface-alt)] px-3 py-2 text-sm font-mono text-[var(--w-text-primary)]">
                  {forwardingAddress}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyAddress}
                  className="shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No forwarding address available.
            </p>
          )}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Scan Frequency                                               */}
      {/* ============================================================ */}
      <Section title="Scan Frequency" icon={Clock}>
        <div className="pt-4">
          <div className="flex items-center justify-between rounded-lg border border-[var(--w-border)] bg-[var(--w-surface-alt)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--w-text-primary)]">
                Current scan interval
              </p>
              <p className="text-xs text-[var(--w-text-muted)] mt-0.5">
                How often Woodhouse checks for new job postings matching your preferences.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--w-primary)]">
                {SCAN_FREQUENCY[plan]}
              </p>
              <p className="text-xs text-[var(--w-text-muted)] capitalize">
                {plan} plan
              </p>
            </div>
          </div>
          {plan === "free" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--w-text-muted)]">
              <Crown className="h-3.5 w-3.5 text-[var(--w-accent)]" />
              <span>
                Upgrade to Pro for 6-hour scans or Premium for hourly scans.{" "}
                <Link
                  href="/settings/subscription"
                  className="text-[var(--w-primary)] hover:underline font-medium"
                >
                  View plans
                </Link>
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Tracked Boards                                               */}
      {/* ============================================================ */}
      <Section title="Tracked Company Boards" icon={Globe}>
        <div className="pt-4 space-y-4">
          <p className="text-xs text-[var(--w-text-muted)]">
            Add Greenhouse or Lever career pages to monitor directly. Woodhouse
            will check these boards alongside aggregator searches.
          </p>

          {/* Existing boards */}
          {boards.length > 0 && (
            <div className="space-y-2">
              {boards.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--w-border)] px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase shrink-0"
                    >
                      {b.platform}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--w-text-primary)] truncate">
                        {b.company_name}
                      </p>
                      <p className="text-xs text-[var(--w-text-muted)] truncate">
                        {b.board_url}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[var(--w-text-muted)] hover:text-[var(--w-error)] shrink-0"
                    onClick={() => handleDeleteBoard(b.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {boards.length === 0 && (
            <p className="text-sm text-[var(--w-text-muted)] italic">
              No tracked boards yet. Add one below.
            </p>
          )}

          {/* Add new board */}
          <div className="rounded-lg border border-dashed border-[var(--w-border)] p-4 space-y-3">
            <p className="text-xs font-medium text-[var(--w-text-secondary)]">
              Add a board
            </p>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <Label className="text-[10px]">Platform</Label>
                <Select
                  value={newBoardPlatform}
                  onValueChange={(v) => v && setNewBoardPlatform(v)}
                >
                  <SelectTrigger className="text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greenhouse">Greenhouse</SelectItem>
                    <SelectItem value="lever">Lever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Company Name</Label>
                <Input
                  value={newBoardCompany}
                  onChange={(e) => setNewBoardCompany(e.target.value)}
                  placeholder="e.g., Stripe"
                  className="text-sm mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Board URL</Label>
              <Input
                value={newBoardUrl}
                onChange={(e) => setNewBoardUrl(e.target.value)}
                placeholder={
                  newBoardPlatform === "greenhouse"
                    ? "https://boards.greenhouse.io/company"
                    : "https://jobs.lever.co/company"
                }
                className="text-sm mt-1"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddBoard}
              disabled={addingBoard}
            >
              {addingBoard ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1" />
              )}
              Add Board
            </Button>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Email Digest                                                 */}
      {/* ============================================================ */}
      <Section title="Email Digest" icon={Mail}>
        <div className="pt-4">
          <p className="text-xs text-[var(--w-text-muted)] mb-3">
            Choose how often you receive email summaries of new discoveries and
            application updates.
          </p>
          <Select value={emailDigest} onValueChange={(v) => v && handleEmailDigestChange(v)}>
            <SelectTrigger className="w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  Tailoring Style (conditional)                                */}
      {/* ============================================================ */}
      {userChoiceEnabled && (
        <Section title="Resume Tailoring Style" icon={Sparkles}>
          <div className="pt-4 space-y-4">
            <p className="text-xs text-[var(--w-text-muted)]">
              These instructions guide how Woodhouse tailors your resume for
              each job. The system&apos;s safety rules (truthfulness, no
              fabrication) always apply.
            </p>

            {/* Template Dropdown */}
            <div>
              <Label className="text-xs">Start from a template (optional)</Label>
              <div className="relative mt-1">
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full h-9 appearance-none rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] pl-3 pr-8 text-sm text-[var(--w-text-secondary)] cursor-pointer"
                >
                  {TAILORING_TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w-text-muted)] pointer-events-none" />
              </div>
            </div>

            {/* Free-text Textarea */}
            <div>
              <Label className="text-xs">Your tailoring instructions</Label>
              <Textarea
                value={tailoringInstructions}
                onChange={(e) => {
                  setTailoringInstructionsState(e.target.value);
                  setSelectedTemplate("");
                }}
                placeholder="Describe how you want your resume tailored..."
                rows={4}
                className="text-sm mt-1"
              />
            </div>

            {/* Save */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--w-border)]">
              <div className="flex items-center gap-1.5 text-xs text-[var(--w-text-muted)]">
                <FileText className="h-3 w-3" />
                {tailoringHasChanges ? "Unsaved changes" : "Saved"}
              </div>
              <Button
                size="sm"
                className="bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
                disabled={!tailoringHasChanges || savePending}
                onClick={handleSaveTailoring}
              >
                {savePending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
