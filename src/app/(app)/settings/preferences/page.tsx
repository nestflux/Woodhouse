"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getTailoringConfig,
  getTailoringInstructions,
  setTailoringInstructions,
} from "@/lib/actions/system-config";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Sparkles,
  FileText,
  ChevronDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Pre-built Templates                                                */
/* ------------------------------------------------------------------ */

const TEMPLATES = [
  {
    value: "",
    label: "Start from scratch",
    text: "",
  },
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
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function PreferencesSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-3xl animate-pulse">
      <div className="h-6 w-48 bg-[var(--w-surface-alt)] rounded mb-2" />
      <div className="h-4 w-72 bg-[var(--w-surface-alt)] rounded mb-8" />
      <div className="h-64 bg-[var(--w-surface-alt)] rounded-[var(--radius-md)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [userChoiceEnabled, setUserChoiceEnabled] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [originalInstructions, setOriginalInstructions] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const [configResult, instructionsResult] = await Promise.all([
        getTailoringConfig(),
        getTailoringInstructions(),
      ]);

      if (configResult.data) {
        setUserChoiceEnabled(configResult.data.userInstructionsEnabled);
      }

      if (instructionsResult.data) {
        setInstructions(instructionsResult.data);
        setOriginalInstructions(instructionsResult.data);

        // Try to match to a template
        const matched = TEMPLATES.find(
          (t) => t.text === instructionsResult.data
        );
        if (matched) {
          setSelectedTemplate(matched.value);
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  function handleTemplateChange(value: string) {
    setSelectedTemplate(value);
    const template = TEMPLATES.find((t) => t.value === value);
    if (template) {
      setInstructions(template.text);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setTailoringInstructions(
        instructions.trim() || null
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Tailoring preferences saved");
        setOriginalInstructions(instructions);
      }
    });
  }

  const hasChanges = instructions !== originalInstructions;

  if (loading) return <PreferencesSkeleton />;

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
        Search Preferences
      </h1>
      <p className="mt-2 text-sm text-[var(--w-text-secondary)] mb-8">
        Configure your job search criteria and tailoring style.
      </p>

      {/* Tailoring Instructions Section — only visible when admin enables user_choice */}
      {userChoiceEnabled && (
        <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[var(--w-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--w-text-primary)]">
              Resume Tailoring Style
            </h2>
          </div>
          <p className="text-xs text-[var(--w-text-muted)] mb-4">
            These instructions guide how Woodhouse tailors your resume for each
            job. The system&apos;s safety rules (truthfulness, no fabrication)
            always apply.
          </p>

          {/* Template Dropdown */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--w-text-secondary)] mb-1">
              Start from a template (optional)
            </label>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full h-9 appearance-none rounded-[var(--radius-sm)] border border-[var(--w-border)] bg-[var(--w-surface)] pl-3 pr-8 text-sm text-[var(--w-text-secondary)] cursor-pointer"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--w-text-muted)] pointer-events-none" />
            </div>
          </div>

          {/* Free-text Textarea */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--w-text-secondary)] mb-1">
              Your tailoring instructions
            </label>
            <Textarea
              value={instructions}
              onChange={(e) => {
                setInstructions(e.target.value);
                setSelectedTemplate(""); // Clear template match when user edits
              }}
              placeholder="Describe how you want your resume tailored. For example: 'Always lead with quantified metrics. Prioritize cloud architecture experience. Keep it to one page.'"
              rows={5}
              className="text-sm"
            />
            <p className="mt-1.5 text-[10px] text-[var(--w-text-muted)]">
              You can select a template above and edit it, or write your own
              from scratch. These instructions apply to all future tailored
              resumes.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--w-border)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--w-text-muted)]">
              <FileText className="h-3 w-3" />
              {hasChanges ? "Unsaved changes" : "Saved"}
            </div>
            <Button
              size="sm"
              className="gap-2 bg-[var(--w-primary)] text-white hover:bg-[var(--w-primary-light)]"
              disabled={!hasChanges || isPending}
              onClick={handleSave}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Preferences
            </Button>
          </div>
        </div>
      )}

      {/* Placeholder for other search preferences (to be built in E13) */}
      {!userChoiceEnabled && (
        <div className="rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-5">
          <p className="text-sm text-[var(--w-text-muted)]">
            Search preference settings will be available here soon.
          </p>
        </div>
      )}
    </div>
  );
}
