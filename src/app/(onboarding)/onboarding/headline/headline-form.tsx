"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { updateHeadline } from "@/lib/actions/profile";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  X,
} from "lucide-react";

interface HeadlineFormProps {
  defaults: {
    headline: string;
    summary: string;
  };
  hasParsedData: boolean;
}

export function HeadlineForm({ defaults, hasParsedData }: HeadlineFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaults);

  // AI assist state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleGenerateSummary() {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-assist",
        { body: { action: "generate_summary" } }
      );

      if (fnError || data?.error) {
        setAiError("Could not generate summary. Please try again.");
        return;
      }

      if (data?.suggestion) {
        setAiSuggestion(data.suggestion);
      }
    } catch {
      setAiError("Could not generate summary. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  function acceptSuggestion() {
    if (aiSuggestion) {
      setForm((prev) => ({ ...prev, summary: aiSuggestion }));
      setAiSuggestion(null);
    }
  }

  function dismissSuggestion() {
    setAiSuggestion(null);
  }

  async function handleContinue() {
    setError(null);
    setSaving(true);
    const result = await updateHeadline(form);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/onboarding/experience");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Professional Headline
          </h1>
          {hasParsedData && (
            <Badge variant="secondary" className="text-xs">
              Pre-filled from resume
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          How would you describe your role? This appears at the top of your
          resume.
        </p>
      </div>

      <div className="grid gap-5">
        {error && (
          <div className="rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
            {error}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={form.headline}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, headline: e.target.value }))
            }
            placeholder="e.g., Senior Software Engineer"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="summary">Professional Summary</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 px-2 py-1 text-xs text-[var(--w-accent)]"
              disabled={aiLoading}
              onClick={handleGenerateSummary}
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-base">&#10024;</span>
              )}
              Help me write this
            </Button>
          </div>
          <Textarea
            id="summary"
            value={form.summary}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, summary: e.target.value }))
            }
            placeholder="A brief 2-3 sentence summary of your professional background and what you're looking for."
            rows={4}
          />
          <p className="text-xs text-[var(--w-text-muted)]">
            2-3 sentences about your background, strengths, and career goals.
          </p>
        </div>

        {/* AI Suggestion */}
        {aiSuggestion && (
          <Card className="border-[var(--w-accent)]">
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-base">&#10024;</span>
                <p className="text-xs font-medium text-[var(--w-accent)]">
                  AI Suggestion
                </p>
              </div>
              <p className="text-sm text-[var(--w-text-primary)]">
                {aiSuggestion}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={acceptSuggestion}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={dismissSuggestion}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {aiError && (
          <div className="rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
            {aiError}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/basics")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
