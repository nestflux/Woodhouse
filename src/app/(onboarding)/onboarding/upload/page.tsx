"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderOpen,
  Award,
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface ParsingSummary {
  work_experiences: number;
  education: number;
  skills: number;
  projects: number;
  certifications: number;
  has_contact_info: boolean;
  has_headline: boolean;
  has_summary: boolean;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [parsingSummary, setParsingSummary] = useState<ParsingSummary | null>(
    null
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setParseError(null);
    setParsingSummary(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 5MB.");
      return;
    }

    setUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated.");
        setUploading(false);
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const filePath = `${user.id}/resume.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      setUploadedFile(file.name);
      setUploading(false);

      // Trigger AI parsing
      setParsing(true);
      const { data: parseResult, error: parseErr } =
        await supabase.functions.invoke("parse-resume", {
          body: { file_path: filePath },
        });

      setParsing(false);

      if (parseErr) {
        setParseError(
          "Resume parsing encountered an issue. You can still continue and enter your information manually."
        );
        return;
      }

      if (parseResult?.error) {
        setParseError(
          "Could not extract data from your resume. You can still continue and enter your information manually."
        );
        return;
      }

      if (parseResult?.summary) {
        setParsingSummary(parseResult.summary);
      }
    } catch {
      setError("Upload failed. Please try again.");
      setUploading(false);
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const totalExtracted = parsingSummary
    ? parsingSummary.work_experiences +
      parsingSummary.education +
      parsingSummary.skills +
      parsingSummary.projects +
      parsingSummary.certifications
    : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Welcome to Woodhouse
        </h1>
        <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
          Upload your resume to get started quickly, or skip to enter your
          information manually.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Option */}
        <Card>
          <CardContent className="pt-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() =>
                !parsing && !uploading && fileInputRef.current?.click()
              }
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                dragActive
                  ? "border-[var(--w-primary)] bg-[var(--w-info-bg)]"
                  : parsing
                    ? "border-[var(--w-accent)] bg-[var(--w-surface-alt)]"
                    : "border-[var(--w-border)] hover:border-[var(--w-primary)] hover:bg-[var(--w-surface-alt)]"
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-[var(--w-primary)]" />
                  <p className="text-sm font-medium text-[var(--w-text-primary)]">
                    Uploading...
                  </p>
                </>
              ) : parsing ? (
                <>
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-[var(--w-accent)]" />
                  <p className="text-sm font-medium text-[var(--w-text-primary)]">
                    Parsing your resume with AI...
                  </p>
                  <p className="mt-1 text-xs text-[var(--w-text-muted)]">
                    This may take a few seconds.
                  </p>
                </>
              ) : uploadedFile && parsingSummary ? (
                <>
                  <CheckCircle2 className="mb-4 h-12 w-12 text-[var(--w-success)]" />
                  <p className="text-sm font-medium text-[var(--w-text-primary)]">
                    {uploadedFile}
                  </p>
                  <p className="mt-1 text-xs text-[var(--w-text-muted)]">
                    Resume parsed successfully.
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                      setParsingSummary(null);
                      setParseError(null);
                      if (fileInputRef.current)
                        fileInputRef.current.value = "";
                    }}
                    className="mt-2 text-xs text-[var(--w-primary)] underline underline-offset-2"
                  >
                    Upload a different file
                  </button>
                </>
              ) : uploadedFile ? (
                <>
                  <FileText className="mb-4 h-12 w-12 text-[var(--w-success)]" />
                  <p className="text-sm font-medium text-[var(--w-text-primary)]">
                    {uploadedFile}
                  </p>
                  <p className="mt-1 text-xs text-[var(--w-text-muted)]">
                    Resume uploaded.
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                      setParsingSummary(null);
                      setParseError(null);
                      if (fileInputRef.current)
                        fileInputRef.current.value = "";
                    }}
                    className="mt-2 text-xs text-[var(--w-primary)] underline underline-offset-2"
                  >
                    Upload a different file
                  </button>
                </>
              ) : (
                <>
                  <Upload className="mb-4 h-12 w-12 text-[var(--w-text-muted)]" />
                  <p className="text-sm font-medium text-[var(--w-text-primary)]">
                    Upload your resume
                  </p>
                  <p className="mt-1 text-xs text-[var(--w-text-muted)]">
                    PDF or DOCX, up to 5MB
                  </p>
                  <p className="mt-3 text-xs text-[var(--w-text-secondary)]">
                    Drag and drop or click to browse
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* Parsing Summary */}
        {parsingSummary && totalExtracted > 0 && (
          <Card className="border-[var(--w-success)]">
            <CardContent className="pt-6">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[var(--w-success)]" />
                <p className="text-sm font-medium text-[var(--w-text-primary)]">
                  Successfully extracted from your resume
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {parsingSummary.work_experiences > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--w-surface-alt)] px-3 py-2">
                    <Briefcase className="h-4 w-4 text-[var(--w-primary)]" />
                    <span className="text-sm text-[var(--w-text-primary)]">
                      {parsingSummary.work_experiences} work experience
                      {parsingSummary.work_experiences !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {parsingSummary.education > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--w-surface-alt)] px-3 py-2">
                    <GraduationCap className="h-4 w-4 text-[var(--w-primary)]" />
                    <span className="text-sm text-[var(--w-text-primary)]">
                      {parsingSummary.education} education
                    </span>
                  </div>
                )}
                {parsingSummary.skills > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--w-surface-alt)] px-3 py-2">
                    <Wrench className="h-4 w-4 text-[var(--w-primary)]" />
                    <span className="text-sm text-[var(--w-text-primary)]">
                      {parsingSummary.skills} skill
                      {parsingSummary.skills !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {parsingSummary.projects > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--w-surface-alt)] px-3 py-2">
                    <FolderOpen className="h-4 w-4 text-[var(--w-primary)]" />
                    <span className="text-sm text-[var(--w-text-primary)]">
                      {parsingSummary.projects} project
                      {parsingSummary.projects !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {parsingSummary.certifications > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--w-surface-alt)] px-3 py-2">
                    <Award className="h-4 w-4 text-[var(--w-primary)]" />
                    <span className="text-sm text-[var(--w-text-primary)]">
                      {parsingSummary.certifications} certification
                      {parsingSummary.certifications !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-[var(--w-text-muted)]">
                This data will pre-fill the next steps. You can review and edit
                everything.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Parse error — non-blocking */}
        {parseError && (
          <div className="flex items-start gap-2 rounded-md bg-[var(--w-warning-bg)] px-3 py-2 text-sm text-[var(--w-warning)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-[var(--w-error-bg)] px-3 py-2 text-sm text-[var(--w-error)]">
            {error}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-auto flex items-center justify-between pt-8">
        <div />
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding/basics")}
            disabled={uploading || parsing}
          >
            Start from scratch
          </Button>
          <Button
            onClick={() => router.push("/onboarding/basics")}
            disabled={uploading || parsing}
          >
            {parsing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
