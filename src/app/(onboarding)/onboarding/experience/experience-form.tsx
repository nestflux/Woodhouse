"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  createWorkExperience,
  deleteWorkExperience,
} from "@/lib/actions/work-experience";
import {
  createAchievement,
  updateAchievement,
  deleteAchievement,
} from "@/lib/actions/achievement";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
} from "lucide-react";

interface Achievement {
  id: string;
  description: string;
  metrics?: string | null;
}

interface Experience {
  id: string;
  company_name: string;
  job_title: string;
  location?: string | null;
  country?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current: boolean;
  description?: string | null;
  achievements: Achievement[];
}

interface ExperienceFormProps {
  initialExperiences: Experience[];
  hasParsedData: boolean;
  parsedExperiences: Array<Record<string, unknown>>;
}

interface NewExperience {
  company_name: string;
  job_title: string;
  location: string;
  country: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
}

const emptyExperience: NewExperience = {
  company_name: "",
  job_title: "",
  location: "",
  country: "",
  start_date: "",
  end_date: "",
  is_current: false,
  description: "",
};

interface AiImprovement {
  achievementId: string;
  suggestion: string;
}

export function ExperienceForm({
  initialExperiences,
  hasParsedData,
  parsedExperiences,
}: ExperienceFormProps) {
  const router = useRouter();
  const [experiences, setExperiences] =
    useState<Experience[]>(initialExperiences);
  const [expandedId, setExpandedId] = useState<string | null>(
    experiences[0]?.id ?? null
  );
  const [showAddForm, setShowAddForm] = useState(
    experiences.length === 0 && parsedExperiences.length === 0
  );
  const [newExp, setNewExp] = useState<NewExperience>(emptyExperience);
  const [bulletByExp, setBulletByExp] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noExperience, setNoExperience] = useState(false);
  const [showImportPrompt, setShowImportPrompt] = useState(
    hasParsedData &&
      parsedExperiences.length > 0 &&
      initialExperiences.length === 0
  );

  // AI improvement state
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiImprovement, setAiImprovement] = useState<AiImprovement | null>(
    null
  );
  const [aiError, setAiError] = useState<string | null>(null);

  async function importParsedExperiences() {
    setSaving(true);
    setError(null);
    let skipped = 0;

    for (const pe of parsedExperiences) {
      const startDate = pe.start_date as string;
      if (!startDate) {
        skipped++;
        continue;
      }

      const result = await createWorkExperience({
        company_name: (pe.company_name as string) || "",
        job_title: (pe.job_title as string) || "",
        location: (pe.location as string) || "",
        country: (pe.country as string) || "",
        start_date: startDate,
        end_date: (pe.end_date as string) || "",
        is_current: (pe.is_current as boolean) ?? false,
        description: (pe.description as string) || "",
      });

      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }

      if (result.data && pe.achievements) {
        const achievements = pe.achievements as Array<Record<string, unknown>>;
        for (const ach of achievements) {
          await createAchievement({
            work_experience_id: result.data.id,
            description: (ach.description as string) || "",
          });
        }
      }
    }

    setShowImportPrompt(false);
    setSaving(false);
    if (skipped > 0) {
      setError(
        `${skipped} experience${skipped !== 1 ? "s were" : " was"} skipped due to missing start date. You can add ${skipped !== 1 ? "them" : "it"} manually.`
      );
    }
    router.refresh();
  }

  async function handleAddExperience() {
    setError(null);
    if (!newExp.company_name.trim() || !newExp.job_title.trim()) {
      setError("Company name and job title are required.");
      return;
    }
    if (!newExp.start_date) {
      setError("Start date is required.");
      return;
    }

    setSaving(true);
    const result = await createWorkExperience(newExp);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.data) {
      setExperiences((prev) => [
        ...prev,
        { ...result.data, achievements: [] },
      ]);
      setExpandedId(result.data.id);
    }

    setNewExp(emptyExperience);
    setShowAddForm(false);
  }

  async function handleDeleteExperience(id: string) {
    if (!confirm("Remove this work experience and all its achievements?"))
      return;
    const result = await deleteWorkExperience(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setExperiences((prev) => prev.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleAddBullet(experienceId: string) {
    const bullet = bulletByExp[experienceId]?.trim();
    if (!bullet) return;
    setSaving(true);
    const result = await createAchievement({
      work_experience_id: experienceId,
      description: bullet,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setExperiences((prev) =>
        prev.map((e) =>
          e.id === experienceId
            ? { ...e, achievements: [...e.achievements, result.data!] }
            : e
        )
      );
    }
    setBulletByExp((prev) => ({ ...prev, [experienceId]: "" }));
  }

  async function handleDeleteBullet(experienceId: string, bulletId: string) {
    const result = await deleteAchievement(bulletId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setExperiences((prev) =>
      prev.map((e) =>
        e.id === experienceId
          ? {
              ...e,
              achievements: e.achievements.filter((a) => a.id !== bulletId),
            }
          : e
      )
    );
  }

  async function handleImproveAchievement(
    achievementId: string,
    description: string,
    experienceId: string
  ) {
    setAiLoadingId(achievementId);
    setAiError(null);
    setAiImprovement(null);

    const exp = experiences.find((e) => e.id === experienceId);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-assist",
        {
          body: {
            action: "improve_achievement",
            achievement_id: achievementId,
            description,
            job_title: exp?.job_title,
            company_name: exp?.company_name,
          },
        }
      );

      if (fnError || data?.error) {
        setAiError("Could not improve this bullet. Please try again.");
        return;
      }

      if (data?.suggestion) {
        setAiImprovement({
          achievementId,
          suggestion: data.suggestion,
        });
      }
    } catch {
      setAiError("Could not improve this bullet. Please try again.");
    } finally {
      setAiLoadingId(null);
    }
  }

  async function acceptImprovement(experienceId: string) {
    if (!aiImprovement) return;
    setSaving(true);
    const result = await updateAchievement(aiImprovement.achievementId, {
      description: aiImprovement.suggestion,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setExperiences((prev) =>
      prev.map((e) =>
        e.id === experienceId
          ? {
              ...e,
              achievements: e.achievements.map((a) =>
                a.id === aiImprovement.achievementId
                  ? { ...a, description: aiImprovement.suggestion }
                  : a
              ),
            }
          : e
      )
    );
    setAiImprovement(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Work Experience
          </h1>
          {hasParsedData && initialExperiences.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Pre-filled from resume
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Add your work history and key achievements. These power the AI
          tailoring engine.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
          {error}
        </div>
      )}

      {aiError && (
        <div className="mb-4 rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
          {aiError}
        </div>
      )}

      {/* Import prompt for parsed data */}
      {showImportPrompt && (
        <Card className="mb-6 border-[var(--w-accent)]">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm font-medium text-[var(--w-text-primary)]">
                Found {parsedExperiences.length} work experience
                {parsedExperiences.length !== 1 ? "s" : ""} from your resume
              </p>
              <p className="text-xs text-[var(--w-text-muted)]">
                Import them to save time, then review and edit.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportPrompt(false)}
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={importParsedExperiences}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing experiences */}
      <div className="grid gap-4">
        {experiences.map((exp) => (
          <Card key={exp.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() =>
                setExpandedId(expandedId === exp.id ? null : exp.id)
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--w-text-primary)]">
                    {exp.job_title} at {exp.company_name}
                  </p>
                  <p className="text-xs text-[var(--w-text-muted)]">
                    {exp.start_date} —{" "}
                    {exp.is_current ? "Present" : exp.end_date}
                    {exp.location ? ` | ${exp.location}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {exp.achievements.length} bullet
                    {exp.achievements.length !== 1 ? "s" : ""}
                  </Badge>
                  {expandedId === exp.id ? (
                    <ChevronUp className="h-4 w-4 text-[var(--w-text-muted)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--w-text-muted)]" />
                  )}
                </div>
              </div>
            </CardHeader>
            {expandedId === exp.id && (
              <CardContent>
                {/* Achievements */}
                <div className="grid gap-2">
                  {exp.achievements.map((ach) => (
                    <div key={ach.id}>
                      <div className="flex items-start gap-2 rounded-md bg-[var(--w-surface-alt)] px-3 py-2">
                        <span className="mt-0.5 text-xs text-[var(--w-text-muted)]">
                          &bull;
                        </span>
                        <span className="flex-1 text-sm text-[var(--w-text-primary)]">
                          {ach.description}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-1 py-0.5 text-xs text-[var(--w-accent)]"
                            disabled={aiLoadingId === ach.id}
                            onClick={() =>
                              handleImproveAchievement(
                                ach.id,
                                ach.description,
                                exp.id
                              )
                            }
                            title="Improve with AI"
                          >
                            {aiLoadingId === ach.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>&#10024;</>
                            )}
                          </Button>
                          <button
                            onClick={() =>
                              handleDeleteBullet(exp.id, ach.id)
                            }
                            className="text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* AI improvement suggestion for this bullet */}
                      {aiImprovement?.achievementId === ach.id && (
                        <div className="mt-1 ml-4 rounded-md border border-[var(--w-accent)] bg-[var(--w-surface)] px-3 py-2">
                          <div className="mb-1 flex items-center gap-1">
                            <span className="text-xs">&#10024;</span>
                            <span className="text-xs font-medium text-[var(--w-accent)]">
                              AI Suggestion
                            </span>
                          </div>
                          <p className="text-sm text-[var(--w-text-primary)]">
                            {aiImprovement.suggestion}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => acceptImprovement(exp.id)}
                              disabled={saving}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setAiImprovement(null)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Add bullet */}
                  <div className="flex gap-2">
                    <Input
                      value={bulletByExp[exp.id] ?? ""}
                      onChange={(e) =>
                        setBulletByExp((prev) => ({
                          ...prev,
                          [exp.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddBullet(exp.id);
                        }
                      }}
                      placeholder="Add an achievement bullet..."
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddBullet(exp.id)}
                      disabled={saving}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[var(--w-error)] hover:bg-[var(--w-error-bg)] hover:text-[var(--w-error)]"
                    onClick={() => handleDeleteExperience(exp.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {experiences.length === 0 &&
        !showAddForm &&
        !showImportPrompt &&
        !noExperience && (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--w-border)] p-8 text-center">
            <p className="text-sm text-[var(--w-text-secondary)]">
              No work experience added yet.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Experience
              </Button>
              <Button
                variant="outline"
                onClick={() => setNoExperience(true)}
              >
                I don&apos;t have work experience yet
              </Button>
            </div>
          </div>
        )}

      {noExperience && experiences.length === 0 && (
        <div className="mt-4 rounded-lg border border-[var(--w-success)] bg-[var(--w-success-bg)] p-4 text-center">
          <p className="text-sm text-[var(--w-text-primary)]">
            No problem! You can add work experience later from your profile
            settings.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => setNoExperience(false)}
          >
            Actually, I do have experience to add
          </Button>
        </div>
      )}

      {/* Add new experience form */}
      {showAddForm ? (
        <Card className="mt-4">
          <CardContent className="grid gap-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Company Name *</Label>
                <Input
                  value={newExp.company_name}
                  onChange={(e) =>
                    setNewExp((p) => ({ ...p, company_name: e.target.value }))
                  }
                  placeholder="Acme Inc."
                />
              </div>
              <div className="grid gap-2">
                <Label>Job Title *</Label>
                <Input
                  value={newExp.job_title}
                  onChange={(e) =>
                    setNewExp((p) => ({ ...p, job_title: e.target.value }))
                  }
                  placeholder="Software Engineer"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Location</Label>
                <Input
                  value={newExp.location}
                  onChange={(e) =>
                    setNewExp((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="San Francisco, CA"
                />
              </div>
              <div className="grid gap-2">
                <Label>Country</Label>
                <Input
                  value={newExp.country}
                  onChange={(e) =>
                    setNewExp((p) => ({ ...p, country: e.target.value }))
                  }
                  placeholder="United States"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={newExp.start_date}
                  onChange={(e) =>
                    setNewExp((p) => ({ ...p, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newExp.end_date}
                  onChange={(e) =>
                    setNewExp((p) => ({ ...p, end_date: e.target.value }))
                  }
                  disabled={newExp.is_current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newExp.is_current}
                onCheckedChange={(checked) =>
                  setNewExp((p) => ({
                    ...p,
                    is_current: checked,
                    end_date: checked ? "" : p.end_date,
                  }))
                }
              />
              <Label className="cursor-pointer">I currently work here</Label>
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newExp.description}
                onChange={(e) =>
                  setNewExp((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Brief description of your role..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddExperience} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Experience
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewExp(emptyExperience);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : experiences.length > 0 ? (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Experience
        </Button>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/headline")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => router.push("/onboarding/education")}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
