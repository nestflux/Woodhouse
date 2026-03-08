"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertSearchPreferences,
  updateProfilePreferences,
} from "@/lib/actions/search-preferences";
import { completeOnboarding } from "@/lib/actions/profile";
import { ArrowLeft, Loader2, X, Check } from "lucide-react";

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
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "JPY",
  "INR",
  "BRL",
  "SGD",
];

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  "united states": "USD",
  usa: "USD",
  us: "USD",
  "united kingdom": "GBP",
  uk: "GBP",
  canada: "CAD",
  australia: "AUD",
  switzerland: "CHF",
  japan: "JPY",
  india: "INR",
  brazil: "BRL",
  singapore: "SGD",
  germany: "EUR",
  france: "EUR",
  italy: "EUR",
  spain: "EUR",
  netherlands: "EUR",
  ireland: "EUR",
  portugal: "EUR",
  austria: "EUR",
  belgium: "EUR",
  finland: "EUR",
};

function currencyForCountry(country: string | null): string {
  if (!country) return "USD";
  return COUNTRY_CURRENCY_MAP[country.toLowerCase()] ?? "USD";
}

interface PreferencesFormProps {
  profile: {
    target_roles: string[];
    target_locations: string[];
    target_countries: string[];
    remote_preference: string;
    min_salary: number | null;
    max_salary: number | null;
    salary_currency: string;
    match_threshold: number;
    country: string | null;
  } | null;
  searchPreferences: {
    keywords: string[];
    excluded_keywords: string[];
    excluded_companies: string[];
    preferred_company_sizes: string[];
    preferred_industries: string[];
    min_salary: number | null;
    max_salary: number | null;
    salary_currency: string;
    job_types: string[];
  } | null;
}

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
    <div className="grid gap-2">
      <Label>{label}</Label>
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
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <p className="text-xs text-[var(--w-text-muted)]">
        Press Enter or comma to add
      </p>
    </div>
  );
}

export function PreferencesForm({
  profile,
  searchPreferences,
}: PreferencesFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetRoles, setTargetRoles] = useState<string[]>(
    profile?.target_roles ?? []
  );
  const [targetCountries, setTargetCountries] = useState<string[]>(
    profile?.target_countries ?? []
  );
  const [targetLocations, setTargetLocations] = useState<string[]>(
    profile?.target_locations ?? []
  );
  const [remotePreference, setRemotePreference] = useState(
    profile?.remote_preference ?? "flexible"
  );
  const [minSalary, setMinSalary] = useState(
    profile?.min_salary?.toString() ?? ""
  );
  const [maxSalary, setMaxSalary] = useState(
    profile?.max_salary?.toString() ?? ""
  );
  const [salaryCurrency, setSalaryCurrency] = useState(
    profile?.salary_currency ?? currencyForCountry(profile?.country ?? null)
  );
  const [matchThreshold, setMatchThreshold] = useState(
    profile?.match_threshold ?? 70
  );
  const [jobTypes, setJobTypes] = useState<string[]>(
    searchPreferences?.job_types ?? ["full_time"]
  );
  const [keywords, setKeywords] = useState<string[]>(
    searchPreferences?.keywords ?? []
  );
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>(
    searchPreferences?.excluded_keywords ?? []
  );
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>(
    searchPreferences?.excluded_companies ?? []
  );
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>(
    searchPreferences?.preferred_industries ?? []
  );
  const [preferredCompanySizes, setPreferredCompanySizes] = useState<string[]>(
    searchPreferences?.preferred_company_sizes ?? []
  );

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

  async function handleComplete() {
    setError(null);
    setSaving(true);

    // Save profile preferences
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
      setError(profileResult.error);
      setSaving(false);
      return;
    }

    // Save search preferences
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
      setError(prefsResult.error);
      setSaving(false);
      return;
    }

    // Complete onboarding
    const completeResult = await completeOnboarding();
    setSaving(false);
    if (completeResult.error) {
      setError(completeResult.error);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Job Search Preferences
        </h1>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Configure what you&apos;re looking for. Woodhouse will use these to
          discover and match jobs.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
          {error}
        </div>
      )}

      <div className="grid gap-6">
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

        <div className="grid gap-2">
          <Label>Remote Preference</Label>
          <Select value={remotePreference} onValueChange={(v) => v && setRemotePreference(v)}>
            <SelectTrigger>
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

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Min Salary</Label>
            <Input
              type="number"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="80000"
            />
          </div>
          <div className="grid gap-2">
            <Label>Max Salary</Label>
            <Input
              type="number"
              value={maxSalary}
              onChange={(e) => setMaxSalary(e.target.value)}
              placeholder="150000"
            />
          </div>
          <div className="grid gap-2">
            <Label>Currency</Label>
            <Select value={salaryCurrency} onValueChange={(v) => v && setSalaryCurrency(v)}>
              <SelectTrigger>
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

        <div className="grid gap-2">
          <Label>Job Types</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map((jt) => (
              <Badge
                key={jt.value}
                variant={jobTypes.includes(jt.value) ? "default" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-sm"
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

        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label>Match Threshold</Label>
            <span className="text-sm font-medium text-[var(--w-primary)]">
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
          <div className="flex justify-between text-xs text-[var(--w-text-muted)]">
            <span>50 — Cast a wide net</span>
            <span>70 — Balanced</span>
            <span>90 — Only strong</span>
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
      </div>

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/projects")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleComplete} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
