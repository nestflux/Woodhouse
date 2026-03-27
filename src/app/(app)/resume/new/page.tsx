"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, User, Loader2, ArrowLeft, FileText, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createUserResume } from "@/lib/actions/resume-builder";
import {
  fromParsedResume,
  fromKnowledgeBase,
} from "@/lib/resume-builder/convert-to-resume-content";
import type { ResumeParsing } from "@/lib/validators/resume-parsing";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function NewResumePage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [creatingFromProfile, setCreatingFromProfile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PDF or DOCX file");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be 5MB or less");
      return;
    }
    setSelectedFile(file);
  }, []);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setUploading(false);
        return;
      }

      // Upload file to storage
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const filePath = `${user.id}/rb_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, selectedFile);

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      // Parse the resume
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Session expired. Please sign in again.");
        setUploading(false);
        return;
      }

      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-resume`;
      const fnRes = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ file_path: filePath }),
      });

      const parseResult = await fnRes.json().catch(() => null);

      if (!fnRes.ok || !parseResult?.data) {
        toast.error(
          parseResult?.error ?? "Resume parsing failed. Try again or use a different file."
        );
        setUploading(false);
        return;
      }

      // Convert parsed data to ResumeContent
      const parsed = parseResult.data as ResumeParsing;
      const content = fromParsedResume(parsed, user.email ?? "");
      const resumeName =
        parsed.full_name
          ? `${parsed.full_name}'s Resume`
          : selectedFile.name.replace(/\.[^.]+$/, "");

      // Create the user_resumes row
      const result = await createUserResume({
        name: resumeName,
        content,
        source_file_path: filePath,
      });

      if (result.error) {
        toast.error(result.error);
        setUploading(false);
        return;
      }

      toast.success("Resume uploaded and parsed");
      router.push(`/resume/${result.data!.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setUploading(false);
    }
  }

  async function handleCreateFromProfile() {
    setCreatingFromProfile(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setCreatingFromProfile(false);
        return;
      }

      // Fetch all knowledge base data
      const [profileRes, expRes, eduRes, skillsRes, projRes, certRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "email, full_name, headline, summary, phone, location, linkedin_url, portfolio_url"
            )
            .eq("id", user.id)
            .single(),
          supabase
            .from("work_experiences")
            .select("id, company_name, job_title, location, start_date, end_date, is_current, achievements(id, description)")
            .eq("profile_id", user.id)
            .order("start_date", { ascending: false }),
          supabase
            .from("education")
            .select("id, institution, degree, field_of_study, start_date, end_date")
            .eq("profile_id", user.id),
          supabase
            .from("skills")
            .select("name")
            .eq("profile_id", user.id),
          supabase
            .from("projects")
            .select("id, name, description, technologies")
            .eq("profile_id", user.id),
          supabase
            .from("certifications")
            .select("id, name, issuing_organization")
            .eq("profile_id", user.id),
        ]);

      if (!profileRes.data) {
        toast.error("Could not load profile data");
        setCreatingFromProfile(false);
        return;
      }

      const content = fromKnowledgeBase({
        profile: profileRes.data,
        workExperiences: (expRes.data ?? []).map((e) => ({
          ...e,
          achievements: (e.achievements ?? []) as Array<{
            id: string;
            description: string;
          }>,
        })),
        education: eduRes.data ?? [],
        skills: skillsRes.data ?? [],
        projects: projRes.data ?? [],
        certifications: certRes.data ?? [],
      });

      const result = await createUserResume({
        name: `${profileRes.data.full_name}'s Resume`,
        content,
      });

      if (result.error) {
        toast.error(result.error);
        setCreatingFromProfile(false);
        return;
      }

      toast.success("Resume created from profile");
      router.push(`/resume/${result.data!.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setCreatingFromProfile(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/resume"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to resumes
        </Link>
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          New Resume
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-muted)]">
          Choose how you want to create your resume.
        </p>
      </div>

      {/* Option Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Upload Resume */}
        <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--w-primary)]/10">
            <Upload className="h-6 w-6 text-[var(--w-primary)]" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--w-text-primary)]">
            Upload Resume
          </h2>
          <p className="mb-4 flex-1 text-sm text-[var(--w-text-muted)]">
            Upload an existing PDF or DOCX resume. We'll parse it and let you
            score and improve it with AI.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            className={`mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
              dragActive
                ? "border-[var(--w-primary)] bg-[var(--w-primary)]/5"
                : "border-[var(--w-border)]"
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--w-primary)]" />
                <span className="text-sm font-medium text-[var(--w-text-primary)]">
                  {selectedFile.name}
                </span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="ml-1 text-[var(--w-text-muted)] hover:text-[var(--w-text-primary)]"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-6 w-6 text-[var(--w-text-muted)]" />
                <p className="mb-1 text-sm text-[var(--w-text-secondary)]">
                  Drag and drop your resume here
                </p>
                <p className="text-xs text-[var(--w-text-muted)]">
                  PDF or DOCX, max 5MB
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!selectedFile && (
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.docx";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFile(file);
                  };
                  input.click();
                }}
              >
                Browse files
              </Button>
            )}
            {selectedFile && (
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading & parsing...
                  </>
                ) : (
                  "Upload & Parse"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Create from Profile */}
        <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--w-accent)]/10">
            <User className="h-6 w-6 text-[var(--w-accent)]" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--w-text-primary)]">
            Create from Profile
          </h2>
          <p className="mb-4 flex-1 text-sm text-[var(--w-text-muted)]">
            Build a resume from your existing Woodhouse profile data (work
            experience, education, skills, etc.).
          </p>
          <Button
            variant="outline"
            onClick={handleCreateFromProfile}
            disabled={creatingFromProfile}
          >
            {creatingFromProfile ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Use my current profile"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
