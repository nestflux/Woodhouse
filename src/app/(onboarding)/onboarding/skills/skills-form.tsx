"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSkill,
  deleteSkill,
  createSkillsBatch,
} from "@/lib/actions/skills";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  X,
  Check,
} from "lucide-react";

const CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "soft", label: "Soft Skill" },
  { value: "language", label: "Language" },
  { value: "certification", label: "Certification" },
  { value: "tool", label: "Tool" },
  { value: "framework", label: "Framework" },
  { value: "other", label: "Other" },
];

const PROFICIENCIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiency: string;
  years_experience?: number | null;
}

interface SkillSuggestion {
  name: string;
  category: string;
  proficiency: string;
}

interface SkillsFormProps {
  initialSkills: Skill[];
  hasParsedData: boolean;
  parsedSkills: Array<Record<string, unknown>>;
}

export function SkillsForm({
  initialSkills,
  hasParsedData,
  parsedSkills,
}: SkillsFormProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [newSkillName, setNewSkillName] = useState("");
  const [newCategory, setNewCategory] = useState("technical");
  const [newProficiency, setNewProficiency] = useState("intermediate");
  const [newYears, setNewYears] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(
    hasParsedData && parsedSkills.length > 0 && initialSkills.length === 0
  );

  // AI suggestion state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SkillSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);

  async function importParsedSkills() {
    setSaving(true);
    setError(null);

    const result = await createSkillsBatch(
      parsedSkills.map((s) => ({
        name: (s.name as string) || "",
        category: (s.category as string) || "other",
        proficiency: (s.proficiency as string) || "intermediate",
        years_experience: s.years_experience as number | undefined,
      }))
    );

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setShowImportPrompt(false);
    setSaving(false);
    router.refresh();
  }

  async function handleAdd() {
    if (!newSkillName.trim()) return;
    setError(null);
    setSaving(true);

    const result = await createSkill({
      name: newSkillName.trim(),
      category: newCategory,
      proficiency: newProficiency,
      years_experience: newYears ? parseInt(newYears) : undefined,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setSkills((prev) => [...prev, result.data!]);
    }
    setNewSkillName("");
    setNewYears("");
  }

  async function handleDelete(id: string) {
    const result = await deleteSkill(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSuggestSkills() {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestions([]);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-assist",
        { body: { action: "suggest_skills" } }
      );

      if (fnError || data?.error) {
        setAiError("Could not suggest skills. Please try again.");
        return;
      }

      if (data?.suggestions && Array.isArray(data.suggestions)) {
        setAiSuggestions(data.suggestions);
      }
    } catch {
      setAiError("Could not suggest skills. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAddSuggestion(suggestion: SkillSuggestion) {
    setAddingSuggestion(suggestion.name);
    const result = await createSkill({
      name: suggestion.name,
      category: suggestion.category || "other",
      proficiency: suggestion.proficiency || "intermediate",
    });

    setAddingSuggestion(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.data) {
      setSkills((prev) => [...prev, result.data!]);
      setAiSuggestions((prev) =>
        prev.filter((s) => s.name !== suggestion.name)
      );
    }
  }

  // Group skills by category
  const grouped = skills.reduce(
    (acc, skill) => {
      const cat = skill.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    },
    {} as Record<string, Skill[]>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Skills
          </h1>
          {hasParsedData && skills.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Pre-filled from resume
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Add your skills with categories and proficiency levels. These help
          match you to the right jobs.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
          {error}
        </div>
      )}

      {showImportPrompt && (
        <Card className="mb-6 border-[var(--w-accent)]">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm font-medium">
                Found {parsedSkills.length} skill
                {parsedSkills.length !== 1 ? "s" : ""} from your resume
              </p>
              <p className="text-xs text-[var(--w-text-muted)]">
                Import them to save time.
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
                onClick={importParsedSkills}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skill tags grouped by category */}
      {Object.entries(grouped).map(([category, categorySkills]) => (
        <div key={category} className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--w-text-muted)]">
            {CATEGORIES.find((c) => c.value === category)?.label ?? category}
          </p>
          <div className="flex flex-wrap gap-2">
            {categorySkills.map((skill) => (
              <Badge
                key={skill.id}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1.5 text-sm"
              >
                {skill.name}
                <span className="ml-1 text-xs text-[var(--w-text-muted)]">
                  (
                  {PROFICIENCIES.find((p) => p.value === skill.proficiency)
                    ?.label ?? skill.proficiency}
                  )
                </span>
                <button
                  onClick={() => handleDelete(skill.id)}
                  className="ml-1 text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ))}

      {/* Add skill input */}
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label className="mb-2 block">Skill Name</Label>
              <Input
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="e.g., React, Python, Project Management"
              />
            </div>
            <div>
              <Label className="mb-2 block">Category</Label>
              <Select
                value={newCategory}
                onValueChange={(v) => v && setNewCategory(v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Proficiency</Label>
              <Select
                value={newProficiency}
                onValueChange={(v) => v && setNewProficiency(v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFICIENCIES.map((prof) => (
                    <SelectItem key={prof.value} value={prof.value}>
                      {prof.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[100px]">
              <Label className="mb-2 block">Years</Label>
              <Input
                type="number"
                min="0"
                max="50"
                value={newYears}
                onChange={(e) => setNewYears(e.target.value)}
                placeholder="3"
                className="w-[80px]"
              />
            </div>
            <div className="self-end">
              <Button
                onClick={handleAdd}
                disabled={saving || !newSkillName.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1 text-xs text-[var(--w-accent)]"
            disabled={aiLoading}
            onClick={handleSuggestSkills}
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="text-base">&#10024;</span>
            )}
            Suggest skills from my experience
          </Button>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <Card className="mt-4 border-[var(--w-accent)]">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">&#10024;</span>
                <p className="text-xs font-medium text-[var(--w-accent)]">
                  AI Suggestions ({aiSuggestions.length})
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => setAiSuggestions([])}
              >
                Dismiss all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.map((suggestion) => (
                <Badge
                  key={suggestion.name}
                  variant="outline"
                  className="flex items-center gap-1 border-[var(--w-accent)] px-3 py-1.5 text-sm"
                >
                  {suggestion.name}
                  <span className="ml-1 text-xs text-[var(--w-text-muted)]">
                    (
                    {CATEGORIES.find((c) => c.value === suggestion.category)
                      ?.label ?? suggestion.category}
                    )
                  </span>
                  <button
                    onClick={() => handleAddSuggestion(suggestion)}
                    disabled={addingSuggestion === suggestion.name}
                    className="ml-1 text-[var(--w-success)] hover:text-[var(--w-success)]"
                    title="Add this skill"
                  >
                    {addingSuggestion === suggestion.name ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setAiSuggestions((prev) =>
                        prev.filter((s) => s.name !== suggestion.name)
                      )
                    }
                    className="ml-0.5 text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {aiError && (
        <div className="mt-4 rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
          {aiError}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/education")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => router.push("/onboarding/projects")}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
