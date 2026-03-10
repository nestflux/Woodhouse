"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  createEducation,
  deleteEducation,
} from "@/lib/actions/education";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date?: string | null;
  end_date?: string | null;
  gpa?: number | null;
  achievements?: string[];
}

interface NewEducation {
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  gpa: string;
}

const emptyEducation: NewEducation = {
  institution: "",
  degree: "",
  field_of_study: "",
  start_date: "",
  end_date: "",
  gpa: "",
};

interface EducationFormProps {
  initialEducation: EducationEntry[];
  hasParsedData: boolean;
  parsedEducation: Array<Record<string, unknown>>;
}

export function EducationForm({
  initialEducation,
  hasParsedData,
  parsedEducation,
}: EducationFormProps) {
  /** Normalize partial dates (YYYY or YYYY-MM) to full YYYY-MM-DD for Postgres */
  function normalizeDate(d: string | null | undefined): string | undefined {
    if (!d) return undefined;
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
    if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
    return trimmed;
  }
  const router = useRouter();
  const [entries, setEntries] = useState<EducationEntry[]>(initialEducation);
  const [showAddForm, setShowAddForm] = useState(
    entries.length === 0 && parsedEducation.length === 0
  );
  const [newEdu, setNewEdu] = useState<NewEducation>(emptyEducation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(
    hasParsedData && parsedEducation.length > 0 && initialEducation.length === 0
  );

  async function importParsedEducation() {
    setSaving(true);
    setError(null);

    for (const pe of parsedEducation) {
      const result = await createEducation({
        institution: (pe.institution as string) || "",
        degree: (pe.degree as string) || "",
        field_of_study: (pe.field_of_study as string) || "",
        start_date: normalizeDate(pe.start_date as string),
        end_date: normalizeDate(pe.end_date as string),
        gpa: pe.gpa as number | undefined,
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    setShowImportPrompt(false);
    setSaving(false);
    router.refresh();
  }

  async function handleAdd() {
    setError(null);
    if (
      !newEdu.institution.trim() ||
      !newEdu.degree.trim() ||
      !newEdu.field_of_study.trim()
    ) {
      setError("Institution, degree, and field of study are required.");
      return;
    }
    setSaving(true);
    const result = await createEducation({
      ...newEdu,
      gpa: newEdu.gpa ? parseFloat(newEdu.gpa) : undefined,
      start_date: newEdu.start_date || undefined,
      end_date: newEdu.end_date || undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setEntries((prev) => [...prev, result.data!]);
    }
    setNewEdu(emptyEducation);
    setShowAddForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this education entry?")) return;
    const result = await deleteEducation(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Education
          </h1>
          {hasParsedData && entries.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Pre-filled from resume
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Add your educational background.
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
                Found {parsedEducation.length} education{" "}
                {parsedEducation.length !== 1 ? "entries" : "entry"} from your
                resume
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
                onClick={importParsedEducation}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--w-text-primary)]">
                    {entry.degree} in {entry.field_of_study}
                  </p>
                  <p className="text-xs text-[var(--w-text-muted)]">
                    {entry.institution}
                    {entry.start_date || entry.end_date
                      ? ` | ${entry.start_date ?? ""} — ${entry.end_date ?? "Present"}`
                      : ""}
                    {entry.gpa ? ` | GPA: ${entry.gpa}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--w-text-muted)] hover:text-[var(--w-error)]"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {entries.length === 0 && !showAddForm && !showImportPrompt && (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--w-border)] p-8 text-center">
          <p className="text-sm text-[var(--w-text-secondary)]">
            No education entries added yet. Add your educational background or
            skip to continue.
          </p>
        </div>
      )}

      {showAddForm ? (
        <Card className="mt-4">
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-2">
              <Label>Institution *</Label>
              <Input
                value={newEdu.institution}
                onChange={(e) =>
                  setNewEdu((p) => ({ ...p, institution: e.target.value }))
                }
                placeholder="Stanford University"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Degree *</Label>
                <Input
                  value={newEdu.degree}
                  onChange={(e) =>
                    setNewEdu((p) => ({ ...p, degree: e.target.value }))
                  }
                  placeholder="Bachelor of Science"
                />
              </div>
              <div className="grid gap-2">
                <Label>Field of Study *</Label>
                <Input
                  value={newEdu.field_of_study}
                  onChange={(e) =>
                    setNewEdu((p) => ({
                      ...p,
                      field_of_study: e.target.value,
                    }))
                  }
                  placeholder="Computer Science"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newEdu.start_date}
                  onChange={(e) =>
                    setNewEdu((p) => ({ ...p, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newEdu.end_date}
                  onChange={(e) =>
                    setNewEdu((p) => ({ ...p, end_date: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>GPA (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="9.99"
                  value={newEdu.gpa}
                  onChange={(e) =>
                    setNewEdu((p) => ({ ...p, gpa: e.target.value }))
                  }
                  placeholder="3.80"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Education
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewEdu(emptyEducation);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Education
        </Button>
      )}

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/experience")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => router.push("/onboarding/skills")}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
