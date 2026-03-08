"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface QueueApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  job_postings: {
    company_name: string;
    company_logo_url: string | null;
    job_title: string;
    location: string | null;
    is_remote: boolean;
  };
  job_evaluations: {
    overall_score: number;
    recommendation: string;
  } | null;
  resume_versions: Array<{
    tailoring_notes: string | null;
  }>;
}

interface QueueResult {
  data: QueueApplication[];
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 20;
const VALID_QUEUE_STATUSES = new Set(["ready", "saved", "skipped"]);

export async function getQueueApplications(
  status: string,
  page = 1
): Promise<{ data?: QueueResult; error?: string }> {
  if (!VALID_QUEUE_STATUSES.has(status)) {
    return { error: "Invalid queue status" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const offset = (page - 1) * PAGE_SIZE;

  // Count total for pagination
  const { count, error: countError } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("status", status);

  if (countError) {
    return { error: `Failed to count applications: ${countError.message}` };
  }

  // Fetch applications with joined data
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, created_at, updated_at,
      job_postings!inner(company_name, company_logo_url, job_title, location, is_remote),
      job_evaluations(overall_score, recommendation),
      resume_versions(tailoring_notes)
    `
    )
    .eq("profile_id", user.id)
    .eq("status", status)
    .eq("resume_versions.is_base", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return { error: `Failed to fetch applications: ${error.message}` };
  }

  // Sort by match score (descending) in JS since Supabase can't order by joined column
  const sorted = (data as unknown as QueueApplication[]).sort((a, b) => {
    const scoreA = a.job_evaluations?.overall_score ?? 0;
    const scoreB = b.job_evaluations?.overall_score ?? 0;
    return scoreB - scoreA;
  });

  return {
    data: {
      data: sorted,
      total: count ?? 0,
      hasMore: offset + PAGE_SIZE < (count ?? 0),
    },
  };
}

export async function skipApplication(
  applicationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("applications")
    .update({ status: "skipped" })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to skip application: ${error.message}` };
  }

  revalidatePath("/queue");
  return {};
}

export async function saveApplicationForLater(
  applicationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("applications")
    .update({ status: "saved" })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to save application: ${error.message}` };
  }

  revalidatePath("/queue");
  return {};
}

export async function moveToReady(
  applicationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("applications")
    .update({ status: "ready" })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to move application to ready: ${error.message}` };
  }

  revalidatePath("/queue");
  return {};
}

/* ------------------------------------------------------------------ */
/*  Application Detail                                                */
/* ------------------------------------------------------------------ */

export interface ApplicationDetail {
  id: string;
  status: string;
  cover_letter: string | null;
  application_answers: Array<{
    question: string;
    answer: string;
    source?: string;
  }>;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  job_postings: {
    id: string;
    company_name: string;
    company_logo_url: string | null;
    job_title: string;
    location: string | null;
    country: string | null;
    is_remote: boolean;
    job_type: string | null;
    experience_level: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    description_raw: string;
    required_skills: string[];
    preferred_skills: string[];
    responsibilities: string[];
    benefits: string[];
    application_url: string | null;
    source_url: string;
    posted_date: string | null;
  };
  job_evaluations: {
    overall_score: number;
    skill_score: number | null;
    experience_score: number | null;
    seniority_score: number | null;
    location_score: number | null;
    technology_score: number | null;
    reasoning: string | null;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  } | null;
  tailored_resume: {
    id: string;
    content_json: Record<string, unknown>;
    content_markdown: string | null;
    tailoring_notes: string | null;
    file_url_pdf: string | null;
    file_url_docx: string | null;
  } | null;
  base_resume: {
    id: string;
    content_json: Record<string, unknown>;
  } | null;
}

export async function getApplicationDetail(
  applicationId: string
): Promise<{ data?: ApplicationDetail; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Fetch application with all related data
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, cover_letter, application_answers, notes, submitted_at, created_at, updated_at,
      job_postings!inner(
        id, company_name, company_logo_url, job_title, location, country,
        is_remote, job_type, experience_level, salary_min, salary_max, salary_currency,
        description_raw, required_skills, preferred_skills, responsibilities, benefits,
        application_url, source_url, posted_date
      ),
      job_evaluations(
        overall_score, skill_score, experience_score, seniority_score,
        location_score, technology_score, reasoning, strengths, gaps, recommendation
      )
    `
    )
    .eq("id", applicationId)
    .eq("profile_id", user.id)
    .single();

  if (error) {
    return { error: `Failed to fetch application: ${error.message}` };
  }

  // Fetch tailored resume version for this application
  const { data: tailoredResume } = await supabase
    .from("resume_versions")
    .select("id, content_json, content_markdown, tailoring_notes, file_url_pdf, file_url_docx")
    .eq("application_id", applicationId)
    .eq("is_base", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch base resume for diff view
  const { data: baseResume } = await supabase
    .from("resume_versions")
    .select("id, content_json")
    .eq("profile_id", user.id)
    .eq("is_base", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = data as unknown as ApplicationDetail;
  result.tailored_resume = tailoredResume
    ? {
        id: tailoredResume.id,
        content_json: tailoredResume.content_json as Record<string, unknown>,
        content_markdown: tailoredResume.content_markdown,
        tailoring_notes: tailoredResume.tailoring_notes,
        file_url_pdf: tailoredResume.file_url_pdf,
        file_url_docx: tailoredResume.file_url_docx,
      }
    : null;
  result.base_resume = baseResume
    ? {
        id: baseResume.id,
        content_json: baseResume.content_json as Record<string, unknown>,
      }
    : null;

  return { data: result };
}

export async function updateApplicationMaterials(
  applicationId: string,
  updates: {
    cover_letter?: string;
    application_answers?: Array<{
      question: string;
      answer: string;
      source?: string;
    }>;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const updateData: Record<string, unknown> = {};
  if (updates.cover_letter !== undefined) {
    updateData.cover_letter = updates.cover_letter;
  }
  if (updates.application_answers !== undefined) {
    updateData.application_answers = updates.application_answers;
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  const { error } = await supabase
    .from("applications")
    .update(updateData)
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to update application: ${error.message}` };
  }

  revalidatePath(`/queue/${applicationId}`);
  return {};
}

/* ------------------------------------------------------------------ */
/*  Approve Application (with subscription limit check)                */
/* ------------------------------------------------------------------ */

export interface ApproveResult {
  application_id: string;
  status: string;
  resume_pdf_url: string | null;
  resume_docx_url: string | null;
  application_url: string | null;
  cover_letter: string | null;
  application_answers: Array<{
    question: string;
    answer: string;
    source?: string;
  }>;
}

export async function approveApplication(
  applicationId: string
): Promise<{ data?: ApproveResult; error?: string; limitExceeded?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check subscription limit
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("applications_used, applications_limit, plan")
    .eq("profile_id", user.id)
    .single();

  if (subError) {
    return { error: `Failed to check subscription: ${subError.message}` };
  }

  if (subscription.applications_used >= subscription.applications_limit) {
    return {
      error: `You've reached your ${subscription.plan} plan limit of ${subscription.applications_limit} applications this period. Upgrade to continue approving applications.`,
      limitExceeded: true,
    };
  }

  // Set status to 'approved' — the handle_application_approved trigger increments applications_used
  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (updateError) {
    return { error: `Failed to approve application: ${updateError.message}` };
  }

  // Fetch the approved application data (for URLs, cover letter, answers)
  const { data: app, error: fetchError } = await supabase
    .from("applications")
    .select(
      `
      id, status, cover_letter, application_answers,
      job_postings!inner(application_url),
      resume_versions!inner(file_url_pdf, file_url_docx)
    `
    )
    .eq("id", applicationId)
    .eq("profile_id", user.id)
    .eq("resume_versions.is_base", false)
    .single();

  if (fetchError) {
    // Application is approved even if this fetch fails — return basic success
    revalidatePath("/queue");
    revalidatePath(`/queue/${applicationId}`);
    return {
      data: {
        application_id: applicationId,
        status: "approved",
        resume_pdf_url: null,
        resume_docx_url: null,
        application_url: null,
        cover_letter: null,
        application_answers: [],
      },
    };
  }

  const posting = app.job_postings as unknown as { application_url: string | null };
  const resumeVersions = app.resume_versions as unknown as Array<{
    file_url_pdf: string | null;
    file_url_docx: string | null;
  }>;
  const rv = resumeVersions?.[0] ?? null;

  revalidatePath("/queue");
  revalidatePath(`/queue/${applicationId}`);

  return {
    data: {
      application_id: applicationId,
      status: "approved",
      resume_pdf_url: rv?.file_url_pdf ?? null,
      resume_docx_url: rv?.file_url_docx ?? null,
      application_url: posting?.application_url ?? null,
      cover_letter: app.cover_letter as string | null,
      application_answers: (app.application_answers ?? []) as Array<{
        question: string;
        answer: string;
        source?: string;
      }>,
    },
  };
}

// Keep quickApproveApplication as a simplified version for queue list actions
export async function quickApproveApplication(
  applicationId: string
): Promise<{ error?: string }> {
  const result = await approveApplication(applicationId);
  if (result.error) {
    return { error: result.error };
  }
  return {};
}

/* ------------------------------------------------------------------ */
/*  Mark as Submitted                                                  */
/* ------------------------------------------------------------------ */

export async function markAsSubmitted(
  applicationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("applications")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to mark as submitted: ${error.message}` };
  }

  revalidatePath("/queue");
  revalidatePath(`/queue/${applicationId}`);
  revalidatePath("/tracker");
  return {};
}

/* ------------------------------------------------------------------ */
/*  Tracker — Kanban Board                                             */
/* ------------------------------------------------------------------ */

export const TRACKER_STATUSES = [
  "submitted",
  "acknowledged",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

const TRACKER_STATUS_SET = new Set<string>(TRACKER_STATUSES);

export interface TrackerApplication {
  id: string;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  companyName: string;
  companyLogoUrl: string | null;
  jobTitle: string;
  overallScore: number | null;
}

export interface TrackerStats {
  totalInPipeline: number;
  responseRate: number;
  avgDaysToResponse: number | null;
}

export async function getTrackerApplications(): Promise<{
  data?: TrackerApplication[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, submitted_at, updated_at,
      job_postings!inner(company_name, company_logo_url, job_title),
      job_evaluations(overall_score)
    `
    )
    .eq("profile_id", user.id)
    .in("status", [...TRACKER_STATUSES])
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: `Failed to fetch tracker applications: ${error.message}` };
  }

  const items: TrackerApplication[] = (data ?? []).map((d) => {
    const jp = d.job_postings as unknown as {
      company_name: string;
      company_logo_url: string | null;
      job_title: string;
    };
    const ev = d.job_evaluations as unknown as {
      overall_score: number;
    } | null;
    return {
      id: d.id,
      status: d.status,
      submittedAt: d.submitted_at,
      updatedAt: d.updated_at,
      companyName: jp.company_name,
      companyLogoUrl: jp.company_logo_url,
      jobTitle: jp.job_title,
      overallScore: ev?.overall_score ?? null,
    };
  });

  return { data: items };
}

export async function getTrackerStats(): Promise<{
  data?: TrackerStats;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Active pipeline statuses (not terminal)
  const pipelineStatuses = [
    "submitted",
    "acknowledged",
    "screening",
    "interviewing",
    "offer",
  ];
  const responseStatuses = [
    "acknowledged",
    "screening",
    "interviewing",
    "offer",
    "accepted",
    "rejected",
  ];

  const [pipelineResult, totalSubmittedResult, responseResult, responseTimesResult] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .in("status", pipelineStatuses),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .in("status", [...TRACKER_STATUSES]),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .in("status", responseStatuses),
      supabase
        .from("applications")
        .select("submitted_at, response_received_at")
        .eq("profile_id", user.id)
        .not("response_received_at", "is", null)
        .not("submitted_at", "is", null),
    ]);

  const totalSubmitted = totalSubmittedResult.count ?? 0;
  const responseCount = responseResult.count ?? 0;
  const responseRate =
    totalSubmitted > 0 ? responseCount / totalSubmitted : 0;

  // Calculate average days to response
  let avgDaysToResponse: number | null = null;
  const responseTimes = responseTimesResult.data ?? [];
  if (responseTimes.length > 0) {
    const totalDays = responseTimes.reduce((sum, r) => {
      const submitted = new Date(r.submitted_at!).getTime();
      const response = new Date(r.response_received_at!).getTime();
      return sum + (response - submitted) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDaysToResponse = Math.round(totalDays / responseTimes.length);
  }

  return {
    data: {
      totalInPipeline: pipelineResult.count ?? 0,
      responseRate,
      avgDaysToResponse,
    },
  };
}

export async function updateTrackerStatus(
  applicationId: string,
  newStatus: string
): Promise<{ error?: string }> {
  if (!TRACKER_STATUS_SET.has(newStatus)) {
    return { error: `Invalid tracker status: ${newStatus}` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  // Set response_received_at when moving from submitted to any response status
  if (
    ["acknowledged", "screening", "interviewing", "offer", "accepted", "rejected"].includes(
      newStatus
    )
  ) {
    // Only set if not already set
    const { data: app } = await supabase
      .from("applications")
      .select("response_received_at")
      .eq("id", applicationId)
      .eq("profile_id", user.id)
      .single();

    if (app && !app.response_received_at) {
      updateData.response_received_at = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("applications")
    .update(updateData)
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to update status: ${error.message}` };
  }

  revalidatePath("/tracker");
  revalidatePath(`/tracker/${applicationId}`);
  revalidatePath("/dashboard");
  return {};
}

/* ------------------------------------------------------------------ */
/*  Tracker Detail                                                     */
/* ------------------------------------------------------------------ */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApplicationEvent {
  id: string;
  event_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TrackerDetail {
  id: string;
  status: string;
  notes: string | null;
  next_step_date: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  cover_letter: string | null;
  application_answers: Array<{
    question: string;
    answer: string;
    source?: string;
  }>;
  job_postings: {
    id: string;
    company_name: string;
    company_logo_url: string | null;
    job_title: string;
    location: string | null;
    is_remote: boolean;
    application_url: string | null;
  };
  job_evaluations: {
    overall_score: number;
    skill_score: number | null;
    experience_score: number | null;
    seniority_score: number | null;
    location_score: number | null;
    technology_score: number | null;
    reasoning: string | null;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  } | null;
  tailored_resume: {
    id: string;
    content_markdown: string | null;
    tailoring_notes: string | null;
    file_url_pdf: string | null;
    file_url_docx: string | null;
  } | null;
  events: ApplicationEvent[];
}

export async function getTrackerDetail(
  applicationId: string
): Promise<{ data?: TrackerDetail; error?: string }> {
  if (!UUID_REGEX.test(applicationId)) {
    return { error: "Invalid application ID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Fetch application with job + evaluation data
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, notes, next_step_date, submitted_at, created_at, updated_at,
      cover_letter, application_answers,
      job_postings!inner(
        id, company_name, company_logo_url, job_title, location,
        is_remote, application_url
      ),
      job_evaluations(
        overall_score, skill_score, experience_score, seniority_score,
        location_score, technology_score, reasoning, strengths, gaps, recommendation
      )
    `
    )
    .eq("id", applicationId)
    .eq("profile_id", user.id)
    .single();

  if (error) {
    return { error: `Application not found` };
  }

  // Fetch tailored resume
  const { data: tailoredResume } = await supabase
    .from("resume_versions")
    .select(
      "id, content_markdown, tailoring_notes, file_url_pdf, file_url_docx"
    )
    .eq("application_id", applicationId)
    .eq("is_base", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch application events (timeline)
  const { data: events } = await supabase
    .from("application_events")
    .select("id, event_type, description, metadata, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  const result = data as unknown as TrackerDetail;
  result.tailored_resume = tailoredResume
    ? {
        id: tailoredResume.id,
        content_markdown: tailoredResume.content_markdown,
        tailoring_notes: tailoredResume.tailoring_notes,
        file_url_pdf: tailoredResume.file_url_pdf,
        file_url_docx: tailoredResume.file_url_docx,
      }
    : null;
  result.events = (events ?? []) as ApplicationEvent[];

  return { data: result };
}

export async function addApplicationNote(
  applicationId: string,
  noteText: string
): Promise<{ error?: string }> {
  if (!UUID_REGEX.test(applicationId)) {
    return { error: "Invalid application ID" };
  }
  if (!noteText.trim()) {
    return { error: "Note text cannot be empty" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("profile_id", user.id)
    .single();

  if (!app) {
    return { error: "Application not found" };
  }

  const { error } = await supabase.from("application_events").insert({
    application_id: applicationId,
    event_type: "note_added",
    description: noteText.trim(),
  });

  if (error) {
    return { error: `Failed to add note: ${error.message}` };
  }

  revalidatePath(`/tracker/${applicationId}`);
  return {};
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function setApplicationReminder(
  applicationId: string,
  date: string | null
): Promise<{ error?: string }> {
  if (!UUID_REGEX.test(applicationId)) {
    return { error: "Invalid application ID" };
  }
  if (date !== null && !DATE_REGEX.test(date)) {
    return { error: "Invalid date format" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("applications")
    .update({ next_step_date: date })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to set reminder: ${error.message}` };
  }

  revalidatePath(`/tracker/${applicationId}`);
  return {};
}
