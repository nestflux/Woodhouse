"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateBasicInfo } from "@/lib/actions/profile";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

interface BasicsFormProps {
  defaults: {
    full_name: string;
    phone: string;
    country: string;
    location: string;
    linkedin_url: string;
    portfolio_url: string;
    github_url: string;
  };
  hasParsedData: boolean;
}

export function BasicsForm({ defaults, hasParsedData }: BasicsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaults);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleContinue() {
    setError(null);
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    const result = await updateBasicInfo(form);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/onboarding/headline");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Basic Information
          </h1>
          {hasParsedData && (
            <Badge variant="secondary" className="text-xs">
              Pre-filled from resume
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Tell us about yourself. This information appears on your resume and
          profile.
        </p>
      </div>

      <div className="grid gap-5">
        {error && (
          <div className="rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
            {error}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="full_name">
            Full Name <span className="text-[var(--w-error)]">*</span>
          </Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+1 555-123-4567"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder="United States"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">City / Region</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="San Francisco, CA"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="linkedin_url">LinkedIn URL (optional)</Label>
          <Input
            id="linkedin_url"
            type="url"
            value={form.linkedin_url}
            onChange={(e) => update("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="portfolio_url">Portfolio URL (optional)</Label>
            <Input
              id="portfolio_url"
              type="url"
              value={form.portfolio_url}
              onChange={(e) => update("portfolio_url", e.target.value)}
              placeholder="https://yourportfolio.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="github_url">GitHub URL (optional)</Label>
            <Input
              id="github_url"
              type="url"
              value={form.github_url}
              onChange={(e) => update("github_url", e.target.value)}
              placeholder="https://github.com/username"
            />
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/upload")}
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
