"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createManualJob } from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Link2,
  PenLine,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

interface ParsedJobData {
  job_title: string;
  company_name: string;
  description_raw: string;
  location?: string | null;
  country?: string | null;
  is_remote?: boolean;
  job_type?: string | null;
  experience_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  application_url?: string | null;
  required_skills?: string[];
  preferred_skills?: string[];
  responsibilities?: string[];
  benefits?: string[];
  description_structured?: {
    about?: string;
    responsibilities?: string[];
    requirements?: string[];
    preferred?: string[];
    benefits?: string[];
  } | null;
}

const JOB_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
];

const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "director", label: "Director" },
  { value: "executive", label: "Executive" },
];

export default function AddJobPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("url");

  // URL tab state
  const [url, setUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedJobData | null>(null);

  // Shared form state (used for both parsed review + manual entry)
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [descriptionRaw, setDescriptionRaw] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [jobType, setJobType] = useState<string>("");
  const [experienceLevel, setExperienceLevel] = useState<string>("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [preferredSkills, setPreferredSkills] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function populateForm(data: ParsedJobData) {
    setJobTitle(data.job_title || "");
    setCompanyName(data.company_name || "");
    setDescriptionRaw(data.description_raw || "");
    setLocation(data.location || "");
    setCountry(data.country || "");
    setIsRemote(data.is_remote ?? false);
    setJobType(data.job_type || "");
    setExperienceLevel(data.experience_level || "");
    setApplicationUrl(data.application_url || "");
    setSalaryMin(data.salary_min?.toString() || "");
    setSalaryMax(data.salary_max?.toString() || "");
    setSalaryCurrency(data.salary_currency || "");
    setRequiredSkills((data.required_skills ?? []).join(", "));
    setPreferredSkills((data.preferred_skills ?? []).join(", "));
  }

  async function handleFetchAndParse() {
    if (!url.trim()) return;
    setParseError(null);
    setParsedData(null);
    setParsing(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke(
        "parse-job-url",
        { body: { url: url.trim() } }
      );

      if (error) {
        setParseError(
          "Could not reach the parsing service. Please try again or use Manual Entry."
        );
        setParsing(false);
        return;
      }

      if (data?.error) {
        setParseError(data.error);
        setParsing(false);
        return;
      }

      if (data?.data) {
        const parsed = data.data as ParsedJobData;
        setParsedData(parsed);
        populateForm(parsed);
      }
    } catch {
      setParseError("An unexpected error occurred. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    setSaveError(null);

    if (!jobTitle.trim()) {
      setSaveError("Job title is required.");
      return;
    }
    if (!companyName.trim()) {
      setSaveError("Company name is required.");
      return;
    }
    if (!descriptionRaw.trim() || descriptionRaw.trim().length < 10) {
      setSaveError("Description must be at least 10 characters.");
      return;
    }

    setSaving(true);

    try {
      const parsedSalaryMin = salaryMin ? Number(salaryMin) : null;
      const parsedSalaryMax = salaryMax ? Number(salaryMax) : null;

      if (parsedSalaryMin !== null && isNaN(parsedSalaryMin)) {
        setSaveError("Invalid minimum salary value.");
        setSaving(false);
        return;
      }
      if (parsedSalaryMax !== null && isNaN(parsedSalaryMax)) {
        setSaveError("Invalid maximum salary value.");
        setSaving(false);
        return;
      }

      const result = await createManualJob({
        job_title: jobTitle.trim(),
        company_name: companyName.trim(),
        description_raw: descriptionRaw.trim(),
        location: location.trim() || null,
        country: country.trim() || null,
        is_remote: isRemote,
        job_type: (jobType || null) as "full_time" | "part_time" | "contract" | "freelance" | "internship" | null,
        experience_level: (experienceLevel || null) as "entry" | "mid" | "senior" | "lead" | "director" | "executive" | null,
        salary_min: parsedSalaryMin,
        salary_max: parsedSalaryMax,
        salary_currency: salaryCurrency.trim() || null,
        application_url: applicationUrl.trim() || url.trim() || null,
        required_skills: requiredSkills
          ? requiredSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        preferred_skills: preferredSkills
          ? preferredSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        source_url: url.trim() || "",
        description_structured: parsedData?.description_structured ?? null,
      });

      if (result.error) {
        setSaveError(result.error);
        setSaving(false);
        return;
      }

      const pipelineStatus = result.data?.pipeline_status;
      toast.success("Job saved!", {
        description:
          pipelineStatus === "evaluating"
            ? "Evaluation is running in the background."
            : "Job posting has been created.",
      });

      router.push("/jobs");
    } catch {
      setSaveError("An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const showReviewForm = activeTab === "url" && parsedData;
  const showManualForm = activeTab === "manual";
  const showForm = showReviewForm || showManualForm;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Add Job
          </h1>
          <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
            Add a job posting by URL or enter the details manually.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v) setActiveTab(v);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1 gap-2">
              <Link2 className="h-4 w-4" />
              Paste URL
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-2">
              <PenLine className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            {!parsedData && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Paste a job posting URL</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/jobs/software-engineer"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={parsing}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleFetchAndParse();
                      }}
                    />
                    <Button
                      onClick={handleFetchAndParse}
                      disabled={!url.trim() || parsing}
                      className="shrink-0"
                    >
                      {parsing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        "Fetch & Parse"
                      )}
                    </Button>
                  </div>

                  {parsing && (
                    <p className="mt-3 text-xs text-[var(--w-text-muted)]">
                      Fetching and analyzing the job posting. This may take a
                      few seconds...
                    </p>
                  )}

                  {parseError && (
                    <div className="mt-3 flex items-start gap-2 rounded-md bg-[var(--w-warning-bg)] px-3 py-2 text-sm text-[var(--w-warning)]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {parsedData && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-[var(--w-success-bg)] px-3 py-2 text-sm text-[var(--w-success)]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Job data extracted successfully. Review and edit below, then
                  save.
                </span>
                <button
                  onClick={() => {
                    setParsedData(null);
                    setParseError(null);
                  }}
                  className="ml-auto text-xs underline underline-offset-2"
                >
                  Parse a different URL
                </button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual">
            <p className="mt-4 text-sm text-[var(--w-text-secondary)]">
              Enter the job details below. Fields marked with * are required.
            </p>
          </TabsContent>
        </Tabs>

        {showForm && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="grid gap-4">
                {/* Job Title */}
                <div className="grid gap-1.5">
                  <Label htmlFor="job_title">Job Title *</Label>
                  <Input
                    id="job_title"
                    placeholder="e.g., Senior Software Engineer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>

                {/* Company Name */}
                <div className="grid gap-1.5">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    placeholder="e.g., Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                {/* Location & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g., San Francisco, CA"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="country">Country Code</Label>
                    <Input
                      id="country"
                      placeholder="e.g., US, GB, DE"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      maxLength={2}
                    />
                  </div>
                </div>

                {/* Remote Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isRemote}
                    onCheckedChange={setIsRemote}
                    id="is_remote"
                  />
                  <Label htmlFor="is_remote">Remote position</Label>
                </div>

                {/* Job Type & Experience Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Job Type</Label>
                    <Select
                      value={jobType}
                      onValueChange={(v) => setJobType(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Experience Level</Label>
                    <Select
                      value={experienceLevel}
                      onValueChange={(v) => setExperienceLevel(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE_LEVELS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Salary Range */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="salary_min">Salary Min</Label>
                    <Input
                      id="salary_min"
                      type="number"
                      placeholder="e.g., 80000"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="salary_max">Salary Max</Label>
                    <Input
                      id="salary_max"
                      type="number"
                      placeholder="e.g., 120000"
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="salary_currency">Currency</Label>
                    <Input
                      id="salary_currency"
                      placeholder="e.g., USD"
                      value={salaryCurrency}
                      onChange={(e) => setSalaryCurrency(e.target.value)}
                      maxLength={3}
                    />
                  </div>
                </div>

                {/* Application URL */}
                <div className="grid gap-1.5">
                  <Label htmlFor="application_url">Application URL</Label>
                  <Input
                    id="application_url"
                    placeholder="https://example.com/apply"
                    value={applicationUrl}
                    onChange={(e) => setApplicationUrl(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="grid gap-1.5">
                  <Label htmlFor="description_raw">Job Description *</Label>
                  <Textarea
                    id="description_raw"
                    placeholder="Paste the full job description here..."
                    value={descriptionRaw}
                    onChange={(e) => setDescriptionRaw(e.target.value)}
                    rows={10}
                  />
                </div>

                {/* Required Skills */}
                <div className="grid gap-1.5">
                  <Label htmlFor="required_skills">Required Skills</Label>
                  <Input
                    id="required_skills"
                    placeholder="e.g., Python, React, PostgreSQL (comma-separated)"
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                  />
                  <p className="text-xs text-[var(--w-text-muted)]">
                    Comma-separated list of required skills
                  </p>
                </div>

                {/* Preferred Skills */}
                <div className="grid gap-1.5">
                  <Label htmlFor="preferred_skills">Preferred Skills</Label>
                  <Input
                    id="preferred_skills"
                    placeholder="e.g., GraphQL, Docker, AWS (comma-separated)"
                    value={preferredSkills}
                    onChange={(e) => setPreferredSkills(e.target.value)}
                  />
                  <p className="text-xs text-[var(--w-text-muted)]">
                    Comma-separated list of nice-to-have skills
                  </p>
                </div>

                {/* Error */}
                {saveError && (
                  <div className="rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
                    {saveError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/jobs")}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save & Evaluate"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
