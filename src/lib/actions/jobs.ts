"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Job Feed                                                           */
/* ------------------------------------------------------------------ */

export interface JobFeedItem {
  id: string;
  companyName: string;
  companyLogoUrl: string | null;
  jobTitle: string;
  location: string | null;
  isRemote: boolean;
  source: string;
  postedDate: string | null;
  discoveredAt: string;
  jobPostingStatus: string;
  evaluation: {
    overallScore: number;
    recommendation: string;
    passesThreshold: boolean;
  } | null;
  applicationId: string | null;
}

export interface JobFeedFilters {
  search?: string;
  source?: string;
  scoreMin?: number;
  scoreMax?: number;
  country?: string;
  location?: string;
  isRemote?: boolean;
  status?: string;
  sort?: "score" | "newest" | "company";
  page?: number;
}

interface JobFeedResult {
  data: JobFeedItem[];
  total: number;
  hasMore: boolean;
}

const JOB_FEED_PAGE_SIZE = 20;

export async function getJobFeed(
  filters: JobFeedFilters = {}
): Promise<{ data?: JobFeedResult; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const page = filters.page ?? 1;
  const offset = (page - 1) * JOB_FEED_PAGE_SIZE;

  // Query job_evaluations (user-scoped) joined with job_postings
  let query = supabase
    .from("job_evaluations")
    .select(
      `
      id, overall_score, recommendation, passes_threshold, evaluated_at,
      job_posting_id,
      job_postings!inner(
        id, company_name, company_logo_url, job_title, location, country,
        is_remote, source, posted_date, discovered_at, status
      )
    `,
      { count: "exact" }
    )
    .eq("profile_id", user.id);

  // Apply filters on the joined job_postings
  if (filters.source) {
    query = query.eq("job_postings.source", filters.source);
  }
  if (filters.status) {
    query = query.eq("job_postings.status", filters.status);
  }
  if (filters.isRemote !== undefined) {
    query = query.eq("job_postings.is_remote", filters.isRemote);
  }
  if (filters.country) {
    query = query.eq("job_postings.country", filters.country);
  }
  if (filters.scoreMin !== undefined) {
    query = query.gte("overall_score", filters.scoreMin);
  }
  if (filters.scoreMax !== undefined) {
    query = query.lte("overall_score", filters.scoreMax);
  }

  // Text search on job_postings fields
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      `job_postings.job_title.ilike.${term},job_postings.company_name.ilike.${term}`
    );
  }

  // Location text search
  if (filters.location) {
    query = query.ilike("job_postings.location", `%${filters.location}%`);
  }

  // Sorting
  switch (filters.sort) {
    case "score":
      query = query.order("overall_score", { ascending: false });
      break;
    case "company":
      query = query.order("job_postings(company_name)", { ascending: true });
      break;
    case "newest":
    default:
      query = query.order("evaluated_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + JOB_FEED_PAGE_SIZE - 1);

  const { data, count, error } = await query;

  if (error) {
    return { error: `Failed to fetch jobs: ${error.message}` };
  }

  // Look up applications for these job postings
  const jobPostingIds = (data ?? []).map((d) => {
    const jp = d.job_postings as unknown as { id: string };
    return jp.id;
  });

  let applicationMap: Record<string, string> = {};
  if (jobPostingIds.length > 0) {
    const { data: apps } = await supabase
      .from("applications")
      .select("id, job_posting_id")
      .eq("profile_id", user.id)
      .in("job_posting_id", jobPostingIds);

    if (apps) {
      applicationMap = Object.fromEntries(
        apps.map((a) => [a.job_posting_id, a.id])
      );
    }
  }

  const items: JobFeedItem[] = (data ?? []).map((d) => {
    const jp = d.job_postings as unknown as {
      id: string;
      company_name: string;
      company_logo_url: string | null;
      job_title: string;
      location: string | null;
      is_remote: boolean;
      source: string;
      posted_date: string | null;
      discovered_at: string;
      status: string;
    };
    return {
      id: jp.id,
      companyName: jp.company_name,
      companyLogoUrl: jp.company_logo_url,
      jobTitle: jp.job_title,
      location: jp.location,
      isRemote: jp.is_remote,
      source: jp.source,
      postedDate: jp.posted_date,
      discoveredAt: jp.discovered_at,
      jobPostingStatus: jp.status,
      evaluation: {
        overallScore: d.overall_score,
        recommendation: d.recommendation,
        passesThreshold: d.passes_threshold,
      },
      applicationId: applicationMap[jp.id] ?? null,
    };
  });

  return {
    data: {
      data: items,
      total: count ?? 0,
      hasMore: offset + JOB_FEED_PAGE_SIZE < (count ?? 0),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Add to Queue (for below-threshold jobs)                            */
/* ------------------------------------------------------------------ */

export async function addJobToQueue(
  jobPostingId: string
): Promise<{ data?: { applicationId: string }; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if application already exists
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("profile_id", user.id)
    .eq("job_posting_id", jobPostingId)
    .maybeSingle();

  if (existing) {
    return { data: { applicationId: existing.id } };
  }

  // Get the evaluation for linking
  const { data: evaluation } = await supabase
    .from("job_evaluations")
    .select("id")
    .eq("profile_id", user.id)
    .eq("job_posting_id", jobPostingId)
    .maybeSingle();

  // Create draft application
  const admin = createAdminClient();
  const { data: app, error: appError } = await admin
    .from("applications")
    .insert({
      profile_id: user.id,
      job_posting_id: jobPostingId,
      job_evaluation_id: evaluation?.id ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (appError || !app) {
    return { error: `Failed to create application: ${appError?.message ?? "Unknown error"}` };
  }

  // Enqueue tailoring step (skip pre-screen and evaluation since they already exist)
  const { error: pipelineError } = await admin.from("pipeline_jobs").insert({
    profile_id: user.id,
    job_posting_id: jobPostingId,
    application_id: app.id,
    step: "tailor",
    status: "pending",
  });

  if (pipelineError) {
    return { error: `Failed to enqueue pipeline: ${pipelineError.message}` };
  }

  revalidatePath("/jobs");
  revalidatePath("/queue");

  return { data: { applicationId: app.id } };
}

/* ------------------------------------------------------------------ */
/*  Job Detail                                                         */
/* ------------------------------------------------------------------ */

export interface JobDetail {
  id: string;
  companyName: string;
  companyLogoUrl: string | null;
  jobTitle: string;
  location: string | null;
  country: string | null;
  isRemote: boolean;
  jobType: string | null;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  descriptionRaw: string;
  descriptionStructured: {
    about?: string;
    responsibilities?: string[];
    requirements?: string[];
    preferred?: string[];
    benefits?: string[];
  } | null;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  benefits: string[];
  applicationUrl: string | null;
  sourceUrl: string;
  source: string;
  postedDate: string | null;
  discoveredAt: string;
  status: string;
  evaluation: {
    overallScore: number;
    skillScore: number | null;
    experienceScore: number | null;
    seniorityScore: number | null;
    locationScore: number | null;
    technologyScore: number | null;
    reasoning: string | null;
    strengths: string[];
    gaps: string[];
    recommendation: string;
    passesThreshold: boolean;
  } | null;
  applicationId: string | null;
  applicationStatus: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getJobDetail(
  jobPostingId: string
): Promise<{ data?: JobDetail; error?: string }> {
  if (!UUID_REGEX.test(jobPostingId)) {
    return { error: "Invalid job ID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Fetch job posting
  const { data: posting, error: postingError } = await supabase
    .from("job_postings")
    .select(
      `
      id, company_name, company_logo_url, job_title, location, country,
      is_remote, job_type, experience_level, salary_min, salary_max, salary_currency,
      description_raw, description_structured, required_skills, preferred_skills,
      responsibilities, benefits, application_url, source_url, source,
      posted_date, discovered_at, status
    `
    )
    .eq("id", jobPostingId)
    .single();

  if (postingError || !posting) {
    return { error: `Job posting not found: ${postingError?.message ?? "Not found"}` };
  }

  // Fetch user's evaluation for this job
  const { data: evaluation } = await supabase
    .from("job_evaluations")
    .select(
      `
      overall_score, skill_score, experience_score, seniority_score,
      location_score, technology_score, reasoning, strengths, gaps,
      recommendation, passes_threshold
    `
    )
    .eq("profile_id", user.id)
    .eq("job_posting_id", jobPostingId)
    .maybeSingle();

  // Check if user has an application for this job
  const { data: application } = await supabase
    .from("applications")
    .select("id, status")
    .eq("profile_id", user.id)
    .eq("job_posting_id", jobPostingId)
    .maybeSingle();

  return {
    data: {
      id: posting.id,
      companyName: posting.company_name,
      companyLogoUrl: posting.company_logo_url,
      jobTitle: posting.job_title,
      location: posting.location,
      country: posting.country,
      isRemote: posting.is_remote,
      jobType: posting.job_type,
      experienceLevel: posting.experience_level,
      salaryMin: posting.salary_min,
      salaryMax: posting.salary_max,
      salaryCurrency: posting.salary_currency,
      descriptionRaw: posting.description_raw,
      descriptionStructured: posting.description_structured as JobDetail["descriptionStructured"],
      requiredSkills: posting.required_skills ?? [],
      preferredSkills: posting.preferred_skills ?? [],
      responsibilities: posting.responsibilities ?? [],
      benefits: posting.benefits ?? [],
      applicationUrl: posting.application_url,
      sourceUrl: posting.source_url,
      source: posting.source,
      postedDate: posting.posted_date,
      discoveredAt: posting.discovered_at,
      status: posting.status,
      evaluation: evaluation
        ? {
            overallScore: evaluation.overall_score,
            skillScore: evaluation.skill_score,
            experienceScore: evaluation.experience_score,
            seniorityScore: evaluation.seniority_score,
            locationScore: evaluation.location_score,
            technologyScore: evaluation.technology_score,
            reasoning: evaluation.reasoning,
            strengths: evaluation.strengths ?? [],
            gaps: evaluation.gaps ?? [],
            recommendation: evaluation.recommendation,
            passesThreshold: evaluation.passes_threshold,
          }
        : null,
      applicationId: application?.id ?? null,
      applicationStatus: application?.status ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Prepare Application (trigger pipeline from job detail)             */
/* ------------------------------------------------------------------ */

export async function prepareApplication(
  jobPostingId: string
): Promise<{ data?: { applicationId: string }; error?: string }> {
  if (!UUID_REGEX.test(jobPostingId)) {
    return { error: "Invalid job ID" };
  }
  // Delegates to addJobToQueue which handles deduplication
  return addJobToQueue(jobPostingId);
}

/* ------------------------------------------------------------------ */
/*  Manual Job Input                                                   */
/* ------------------------------------------------------------------ */

const ManualJobSchema = z.object({
  job_title: z.string().min(1, "Job title is required"),
  company_name: z.string().min(1, "Company name is required"),
  description_raw: z.string().min(10, "Description is required"),
  location: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  is_remote: z.boolean().optional().default(false),
  job_type: z
    .enum(["full_time", "part_time", "contract", "freelance", "internship"])
    .optional()
    .nullable(),
  experience_level: z
    .enum(["entry", "mid", "senior", "lead", "director", "executive"])
    .optional()
    .nullable(),
  salary_min: z.number().int().optional().nullable(),
  salary_max: z.number().int().optional().nullable(),
  salary_currency: z.string().optional().nullable(),
  application_url: z.string().optional().nullable(),
  required_skills: z.array(z.string()).optional().default([]),
  preferred_skills: z.array(z.string()).optional().default([]),
  responsibilities: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  description_structured: z
    .object({
      about: z.string().optional(),
      responsibilities: z.array(z.string()).optional(),
      requirements: z.array(z.string()).optional(),
      preferred: z.array(z.string()).optional(),
      benefits: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
  source_url: z.string().optional().default(""),
});

export type ManualJobInput = z.input<typeof ManualJobSchema>;

interface ManualJobResult {
  id: string;
  job_title: string;
  company_name: string;
  status: string;
  pipeline_status: string;
}

export async function createManualJob(
  input: ManualJobInput
): Promise<{ data?: ManualJobResult; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const validated = ManualJobSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: validated.error.issues[0]?.message ?? "Validation failed",
    };
  }

  const data = validated.data;

  // Use admin client since job_postings and pipeline_jobs have no user-specific RLS policies
  const admin = createAdminClient();

  // Create job_postings record with source='manual'
  const { data: jobPosting, error: insertError } = await admin
    .from("job_postings")
    .insert({
      source: "manual",
      source_url: data.source_url || data.application_url || "",
      company_name: data.company_name,
      job_title: data.job_title,
      location: data.location ?? null,
      country: data.country ?? null,
      is_remote: data.is_remote,
      job_type: data.job_type ?? null,
      experience_level: data.experience_level ?? null,
      salary_min: data.salary_min ?? null,
      salary_max: data.salary_max ?? null,
      salary_currency: data.salary_currency ?? null,
      description_raw: data.description_raw,
      required_skills: data.required_skills,
      preferred_skills: data.preferred_skills,
      responsibilities: data.responsibilities,
      benefits: data.benefits,
      application_url: data.application_url ?? null,
      description_structured: data.description_structured ?? null,
      status: "active",
    })
    .select("id, job_title, company_name, status")
    .single();

  if (insertError || !jobPosting) {
    return {
      error: `Failed to create job posting: ${insertError?.message ?? "Unknown error"}`,
    };
  }

  // Enqueue pipeline_jobs with step='pre_screen'
  const { error: pipelineError } = await admin.from("pipeline_jobs").insert({
    profile_id: user.id,
    job_posting_id: jobPosting.id,
    step: "pre_screen",
    status: "pending",
  });

  return {
    data: {
      id: jobPosting.id,
      job_title: jobPosting.job_title,
      company_name: jobPosting.company_name,
      status: jobPosting.status,
      pipeline_status: pipelineError ? "error" : "evaluating",
    },
  };
}
