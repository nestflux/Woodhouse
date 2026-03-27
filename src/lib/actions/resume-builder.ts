"use server";

import { createClient } from "@/lib/supabase/server";
import { checkSubscription } from "@/lib/subscription";
import { revalidatePath } from "next/cache";
import type { ResumeContent } from "@/lib/resume-builder/convert-to-resume-content";

// ============================================================
// TYPES
// ============================================================

export interface UserResume {
  id: string;
  profile_id: string;
  name: string;
  content: ResumeContent;
  raw_markdown: string | null;
  source_file_path: string | null;
  overall_score: number | null;
  scoring_breakdown: ScoringBreakdown | null;
  status: string;
  is_active: boolean;
  file_url_pdf: string | null;
  file_url_docx: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoringBreakdown {
  dimensions: Record<
    string,
    { score: number; max: number; feedback: string }
  >;
  suggestions: Suggestion[];
  general_feedback: string[];
}

export interface Suggestion {
  section: string;
  experience_index: number | null;
  bullet_index: number | null;
  original: string;
  suggested: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

// ============================================================
// READ ACTIONS
// ============================================================

export async function getUserResumes(): Promise<{
  data?: UserResume[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("user_resumes")
    .select("*")
    .eq("profile_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: data as UserResume[] };
}

export async function getUserResume(
  id: string
): Promise<{ data?: UserResume; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("user_resumes")
    .select("*")
    .eq("id", id)
    .eq("profile_id", user.id)
    .single();

  if (error) return { error: error.message };
  return { data: data as UserResume };
}

export async function checkResumeLimit(): Promise<{
  data?: { current: number; limit: number; canCreate: boolean };
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sub = await checkSubscription(user.id);
  if (sub.error || !sub.data) return { error: sub.error ?? "No subscription" };

  const { count, error } = await supabase
    .from("user_resumes")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if (error) return { error: error.message };

  const current = count ?? 0;
  const limit = sub.data.resume_builder_limit;
  return { data: { current, limit, canCreate: current < limit } };
}

// ============================================================
// WRITE ACTIONS
// ============================================================

export async function createUserResume(data: {
  name: string;
  content: ResumeContent;
  source_file_path?: string;
}): Promise<{ data?: UserResume; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check plan limit
  const limitCheck = await checkResumeLimit();
  if (limitCheck.error) return { error: limitCheck.error };
  if (!limitCheck.data?.canCreate) {
    return {
      error: `Resume limit reached (${limitCheck.data?.limit}). Upgrade your plan for more.`,
    };
  }

  const { data: resume, error } = await supabase
    .from("user_resumes")
    .insert({
      profile_id: user.id,
      name: data.name.trim(),
      content: data.content,
      source_file_path: data.source_file_path ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/resume");
  return { data: resume as UserResume };
}

export async function updateUserResume(
  id: string,
  updates: Partial<{
    name: string;
    content: ResumeContent;
    raw_markdown: string;
    status: string;
    overall_score: number;
    scoring_breakdown: ScoringBreakdown;
    error: string;
  }>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name.trim();
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.raw_markdown !== undefined)
    updateData.raw_markdown = updates.raw_markdown;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.overall_score !== undefined)
    updateData.overall_score = updates.overall_score;
  if (updates.scoring_breakdown !== undefined)
    updateData.scoring_breakdown = updates.scoring_breakdown;
  if (updates.error !== undefined) updateData.error = updates.error;

  const { error } = await supabase
    .from("user_resumes")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/resume");
  revalidatePath(`/resume/${id}`);
  return { success: true };
}

export async function deleteUserResume(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_resumes")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/resume");
  return { success: true };
}

export async function setActiveResume(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // The DB trigger handles deactivating other resumes
  const { error } = await supabase
    .from("user_resumes")
    .update({ is_active: true })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/resume");
  return { success: true };
}

// ============================================================
// AI ACTIONS (call Edge Functions)
// ============================================================

export async function scoreResume(
  resumeId: string
): Promise<{
  data?: {
    overall_score: number;
    scoring_breakdown: ScoringBreakdown;
  };
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Not authenticated" };

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/score-resume`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_resume_id: resumeId }),
  });

  const result = await res.json().catch(() => null);

  if (!res.ok || !result) {
    return { error: result?.error ?? `Scoring failed (HTTP ${res.status})` };
  }

  revalidatePath(`/resume/${resumeId}`);
  revalidatePath("/resume");
  return {
    data: {
      overall_score: result.overall_score,
      scoring_breakdown: result.scoring_breakdown,
    },
  };
}

export async function improveResume(
  resumeId: string,
  mode: "auto" | "reference" | "custom",
  opts?: {
    referenceResumeContent?: ResumeContent;
    customPrompt?: string;
  }
): Promise<{
  data?: {
    improved_content: ResumeContent;
    changes: Array<{
      section: string;
      experience_index?: number | null;
      bullet_index?: number | null;
      field: string;
      original: string;
      improved: string;
    }>;
    change_summary: string;
  };
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Not authenticated" };

  const body: Record<string, unknown> = {
    user_resume_id: resumeId,
    mode,
  };
  if (mode === "reference" && opts?.referenceResumeContent) {
    body.reference_resume_content = opts.referenceResumeContent;
  }
  if (mode === "custom" && opts?.customPrompt) {
    body.custom_prompt = opts.customPrompt;
  }

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/improve-resume`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const result = await res.json().catch(() => null);

  if (!res.ok || !result) {
    return {
      error: result?.error ?? `Improvement failed (HTTP ${res.status})`,
    };
  }

  return {
    data: {
      improved_content: result.improved_content,
      changes: result.changes,
      change_summary: result.change_summary,
    },
  };
}

// ============================================================
// SUGGESTION APPLICATION ACTIONS
// ============================================================

export async function applyBulletSuggestion(
  resumeId: string,
  path: { experienceIndex: number; bulletIndex: number },
  newText: string
): Promise<{ data?: ResumeContent; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Load current content
  const { data: resume, error: fetchError } = await supabase
    .from("user_resumes")
    .select("content")
    .eq("id", resumeId)
    .eq("profile_id", user.id)
    .single();

  if (fetchError) return { error: fetchError.message };

  const content = resume.content as ResumeContent;
  const exp = content.work_experience[path.experienceIndex];
  if (!exp) return { error: "Experience not found at index" };
  const bullet = exp.achievements[path.bulletIndex];
  if (!bullet) return { error: "Bullet not found at index" };

  // Apply the change
  bullet.text = newText;

  const { error: updateError } = await supabase
    .from("user_resumes")
    .update({ content })
    .eq("id", resumeId)
    .eq("profile_id", user.id);

  if (updateError) return { error: updateError.message };
  revalidatePath(`/resume/${resumeId}`);
  return { data: content };
}

export async function applySummarySuggestion(
  resumeId: string,
  newSummary: string
): Promise<{ data?: ResumeContent; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: resume, error: fetchError } = await supabase
    .from("user_resumes")
    .select("content")
    .eq("id", resumeId)
    .eq("profile_id", user.id)
    .single();

  if (fetchError) return { error: fetchError.message };

  const content = resume.content as ResumeContent;
  content.summary = newSummary;

  const { error: updateError } = await supabase
    .from("user_resumes")
    .update({ content })
    .eq("id", resumeId)
    .eq("profile_id", user.id);

  if (updateError) return { error: updateError.message };
  revalidatePath(`/resume/${resumeId}`);
  return { data: content };
}

export async function applyAllSuggestions(
  resumeId: string,
  improvedContent: ResumeContent
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_resumes")
    .update({ content: improvedContent })
    .eq("id", resumeId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/resume/${resumeId}`);
  revalidatePath("/resume");
  return { success: true };
}

// ============================================================
// EXPORT
// ============================================================

export async function exportResume(
  resumeId: string,
  format: "pdf" | "docx"
): Promise<{
  data?: { url: string };
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Not authenticated" };

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-resume-files`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      user_resume_id: resumeId,
      formats: [format],
    }),
  });

  const result = await res.json().catch(() => null);

  if (!res.ok || !result) {
    return {
      error: result?.error ?? `Export failed (HTTP ${res.status})`,
    };
  }

  const url = format === "pdf" ? result.pdf_url : result.docx_url;
  if (!url) {
    return { error: `No ${format.toUpperCase()} URL returned` };
  }

  revalidatePath(`/resume/${resumeId}`);
  return { data: { url } };
}

// ============================================================
// PROFILE SYNC
// ============================================================

export async function syncResumeToProfile(
  resumeId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use the transactional RPC function to atomically replace profile + KB data
  const { error } = await supabase.rpc("sync_resume_to_profile", {
    resume_id: resumeId,
    user_id: user.id,
  });

  if (error) return { error: `Profile sync failed: ${error.message}` };

  revalidatePath("/resume");
  revalidatePath("/settings/profile");
  return { success: true };
}
