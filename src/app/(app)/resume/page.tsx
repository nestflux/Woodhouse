"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ResumeCard } from "@/components/resume-builder/resume-card";
import {
  getUserResumes,
  checkResumeLimit,
  type UserResume,
} from "@/lib/actions/resume-builder";

export default function ResumeListPage() {
  const [resumes, setResumes] = useState<UserResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitInfo, setLimitInfo] = useState<{
    current: number;
    limit: number;
    canCreate: boolean;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const [resumeResult, limitResult] = await Promise.all([
        getUserResumes(),
        checkResumeLimit(),
      ]);
      if (resumeResult.data) setResumes(resumeResult.data);
      if (limitResult.data) setLimitInfo(limitResult.data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
            Resume Builder
          </h1>
          <p className="mt-1 text-sm text-[var(--w-text-muted)]">
            Build and optimize your base resumes before tailoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {limitInfo && (
            <span className="rounded-full bg-[var(--w-surface)] px-3 py-1 text-xs font-medium text-[var(--w-text-muted)]">
              {limitInfo.current} of {limitInfo.limit} resumes
            </span>
          )}
          {limitInfo?.canCreate !== false ? (
            <Link
              href="/resume/new"
              className={buttonVariants({ variant: "default" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Resume
            </Link>
          ) : (
            <Button
              disabled
              title={`Resume limit reached (${limitInfo?.limit}). Upgrade your plan for more.`}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Resume
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--w-text-muted)]" />
        </div>
      ) : resumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--w-surface)]">
            <FileText className="h-8 w-8 text-[var(--w-text-muted)]" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--w-text-primary)]">
            No resumes yet
          </h2>
          <p className="mb-6 max-w-sm text-sm text-[var(--w-text-muted)]">
            Upload a resume or create one from your profile to get started with
            AI-powered scoring and improvement.
          </p>
          <Link
            href="/resume/new"
            className={buttonVariants({ variant: "default" })}
          >
            Create your first resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              id={resume.id}
              name={resume.name}
              overallScore={resume.overall_score}
              status={resume.status}
              isActive={resume.is_active}
              updatedAt={resume.updated_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
