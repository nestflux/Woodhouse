"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").filter(Boolean);

// Blended cost per 1M tokens (Sonnet ~$3/$15, Haiku ~$0.25/$1.25)
const BLENDED_INPUT_COST_PER_M = 5;
const BLENDED_OUTPUT_COST_PER_M = 10;

// Monthly plan revenue (MP §11)
const PLAN_REVENUE: Record<string, number> = { free: 0, pro: 19, premium: 39 };

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email);
}

export interface PipelineHealthStats {
  pending: number;
  processing: number;
  failed_24h: number;
  zombie: number;
}

export interface StepStatusCounts {
  step: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface FailedJob {
  id: string;
  step: string;
  error: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  profile_id: string;
  user_email: string | null;
  job_title: string | null;
  company: string | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
}

export interface UserCostRow {
  profile_id: string;
  email: string | null;
  plan: string;
  total_jobs: number;
  completed_jobs: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  exceeds_revenue: boolean;
}

export interface ValidationFailureRow {
  step: string;
  total: number;
  failed: number;
  failure_rate: number;
}

export async function getAdminDashboardData() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return { error: "Forbidden" };

  try {
  const admin = createAdminClient();

  // Pipeline Health Stats
  const [pendingRes, processingRes, failed24hRes, zombieRes] = await Promise.all([
    admin
      .from("pipeline_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("pipeline_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
    admin
      .from("pipeline_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    admin
      .from("pipeline_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
  ]);

  const health: PipelineHealthStats = {
    pending: pendingRes.count ?? 0,
    processing: processingRes.count ?? 0,
    failed_24h: failed24hRes.count ?? 0,
    zombie: zombieRes.count ?? 0,
  };

  // Jobs by Step × Status
  const steps = ["pre_screen", "evaluate", "tailor", "generate_materials", "generate_files"];
  const statuses = ["pending", "processing", "completed", "failed"] as const;

  const stepStatusPromises = steps.map(async (step) => {
    const counts = await Promise.all(
      statuses.map((status) =>
        admin
          .from("pipeline_jobs")
          .select("id", { count: "exact", head: true })
          .eq("step", step)
          .eq("status", status)
      )
    );
    return {
      step,
      pending: counts[0].count ?? 0,
      processing: counts[1].count ?? 0,
      completed: counts[2].count ?? 0,
      failed: counts[3].count ?? 0,
    };
  });
  const stepStatusCounts: StepStatusCounts[] = await Promise.all(stepStatusPromises);

  // Recent Failed Jobs (last 50)
  const { data: failedJobsRaw } = await admin
    .from("pipeline_jobs")
    .select(
      "id, step, error, attempts, created_at, started_at, profile_id, input_data, output_data, job_posting_id"
    )
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(50);

  // Enrich with user email and job title
  const failedJobs: FailedJob[] = [];
  if (failedJobsRaw && failedJobsRaw.length > 0) {
    const profileIds = [...new Set(failedJobsRaw.map((j) => j.profile_id))];
    const postingIds = [
      ...new Set(failedJobsRaw.map((j) => j.job_posting_id).filter(Boolean)),
    ];

    const [profilesRes, postingsRes] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", profileIds),
      postingIds.length > 0
        ? admin.from("job_postings").select("id, title, company_name").in("id", postingIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p.email])
    );
    const postingMap = new Map(
      (postingsRes.data ?? []).map((p) => [p.id, { title: p.title, company: p.company_name }])
    );

    for (const j of failedJobsRaw) {
      const posting = j.job_posting_id ? postingMap.get(j.job_posting_id) : null;
      failedJobs.push({
        id: j.id,
        step: j.step,
        error: j.error,
        attempts: j.attempts,
        created_at: j.created_at,
        started_at: j.started_at,
        profile_id: j.profile_id,
        user_email: profileMap.get(j.profile_id) ?? null,
        job_title: posting?.title ?? null,
        company: posting?.company ?? null,
        input_data: j.input_data as Record<string, unknown> | null,
        output_data: j.output_data as Record<string, unknown> | null,
      });
    }
  }

  // Per-User Cost (estimated from pipeline jobs)
  // Group completed jobs by profile, estimate cost from token counts in output_data
  const { data: costRaw } = await admin
    .from("pipeline_jobs")
    .select("profile_id, step, output_data")
    .eq("status", "completed")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const costByUser = new Map<
    string,
    { total_jobs: number; completed_jobs: number; input_tokens: number; output_tokens: number }
  >();

  for (const job of costRaw ?? []) {
    const existing = costByUser.get(job.profile_id) ?? {
      total_jobs: 0,
      completed_jobs: 0,
      input_tokens: 0,
      output_tokens: 0,
    };
    existing.total_jobs++;
    existing.completed_jobs++;
    const od = job.output_data as Record<string, unknown> | null;
    if (od?.usage) {
      const usage = od.usage as { input_tokens?: number; output_tokens?: number };
      existing.input_tokens += usage.input_tokens ?? 0;
      existing.output_tokens += usage.output_tokens ?? 0;
    }
    costByUser.set(job.profile_id, existing);
  }

  // Fetch profiles and subscriptions for cost users
  const costProfileIds = [...costByUser.keys()];
  let userCosts: UserCostRow[] = [];

  if (costProfileIds.length > 0) {
    const [profilesRes, subsRes] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", costProfileIds),
      admin.from("subscriptions").select("profile_id, plan").in("profile_id", costProfileIds),
    ]);

    const emailMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p.email])
    );
    const planMap = new Map(
      (subsRes.data ?? []).map((s) => [s.profile_id, s.plan])
    );

    userCosts = costProfileIds
      .map((pid) => {
        const data = costByUser.get(pid)!;
        const inputCost = (data.input_tokens / 1_000_000) * BLENDED_INPUT_COST_PER_M;
        const outputCost = (data.output_tokens / 1_000_000) * BLENDED_OUTPUT_COST_PER_M;
        const cost = Math.round((inputCost + outputCost) * 100) / 100;
        const plan = planMap.get(pid) ?? "free";
        return {
          profile_id: pid,
          email: emailMap.get(pid) ?? null,
          plan,
          total_jobs: data.total_jobs,
          completed_jobs: data.completed_jobs,
          input_tokens: data.input_tokens,
          output_tokens: data.output_tokens,
          estimated_cost: cost,
          exceeds_revenue: cost > (PLAN_REVENUE[plan] ?? 0),
        };
      })
      .sort((a, b) => b.estimated_cost - a.estimated_cost)
      .slice(0, 20);
  }

  // Validation Failure Rate (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const validationPromises = steps.map(async (step) => {
    const [totalRes, failedRes] = await Promise.all([
      admin
        .from("pipeline_jobs")
        .select("id", { count: "exact", head: true })
        .eq("step", step)
        .gte("created_at", sevenDaysAgo),
      admin
        .from("pipeline_jobs")
        .select("id", { count: "exact", head: true })
        .eq("step", step)
        .eq("status", "failed")
        .gte("created_at", sevenDaysAgo)
        .ilike("error", "%validation%"),
    ]);
    const total = totalRes.count ?? 0;
    const failed = failedRes.count ?? 0;
    return {
      step,
      total,
      failed,
      failure_rate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
    };
  });
  const validationFailures: ValidationFailureRow[] = await Promise.all(validationPromises);

  return {
    health,
    stepStatusCounts,
    failedJobs,
    userCosts,
    validationFailures,
  };
  } catch {
    return { error: "Failed to load dashboard data" };
  }
}
