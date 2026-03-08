"use server";

import { createClient } from "@/lib/supabase/server";

export interface DashboardData {
  queueCount: number;
  applicationsThisPeriod: number;
  applicationsLimit: number;
  totalSubmitted: number;
  responseRate: number;
  interviewRate: number;
  lastDiscoveryRun: {
    completedAt: string | null;
    jobsFound: number;
    jobsMatched: number;
  } | null;
  nextDiscoveryAt: string | null;
  recentMatches: Array<{
    evaluationId: string;
    jobPostingId: string;
    companyName: string;
    companyLogoUrl: string | null;
    jobTitle: string;
    location: string | null;
    isRemote: boolean;
    overallScore: number;
    recommendation: string;
    evaluatedAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    eventType: string;
    description: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    companyName?: string;
    jobTitle?: string;
  }>;
}

// Statuses that indicate a response was received
const RESPONSE_STATUSES = [
  "acknowledged",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
];

// Statuses that indicate an interview stage
const INTERVIEW_STATUSES = [
  "interviewing",
  "offer",
  "accepted",
];

export async function getDashboardData(): Promise<{
  data?: DashboardData;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Run all queries in parallel for performance
  const [
    queueResult,
    totalEverSubmittedResult,
    responseCountResult,
    interviewCountResult,
    subscriptionResult,
    discoveryResult,
    searchPrefsResult,
    matchesResult,
    activityResult,
  ] = await Promise.all([
    // Count applications with status='ready'
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", "ready"),

    // Count all applications that were ever submitted (submitted + all later statuses)
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("status", [
        "submitted",
        ...RESPONSE_STATUSES,
      ]),

    // Count applications that received a response (beyond "submitted")
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("status", RESPONSE_STATUSES),

    // Count applications that reached interview stage
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("status", INTERVIEW_STATUSES),

    // Get subscription data
    supabase
      .from("subscriptions")
      .select("applications_used, applications_limit")
      .eq("profile_id", user.id)
      .single(),

    // Get last completed discovery run
    supabase
      .from("discovery_runs")
      .select("completed_at, jobs_found, jobs_matched")
      .eq("profile_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Get next discovery time from search_preferences
    supabase
      .from("search_preferences")
      .select("next_discovery_at")
      .eq("profile_id", user.id)
      .maybeSingle(),

    // Get 5 most recent evaluations that passed threshold
    supabase
      .from("job_evaluations")
      .select(
        `
        id, overall_score, recommendation, evaluated_at,
        job_postings!inner(id, company_name, company_logo_url, job_title, location, is_remote)
      `
      )
      .eq("profile_id", user.id)
      .eq("passes_threshold", true)
      .order("evaluated_at", { ascending: false })
      .limit(5),

    // Get recent application events (via join through applications)
    supabase
      .from("application_events")
      .select(
        `
        id, event_type, description, metadata, created_at,
        applications!inner(profile_id, job_postings!inner(company_name, job_title))
      `
      )
      .eq("applications.profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Calculate rates using count-only queries
  const totalEverSubmitted = totalEverSubmittedResult.count ?? 0;
  const responseCount = responseCountResult.count ?? 0;
  const interviewCount = interviewCountResult.count ?? 0;

  const responseRate =
    totalEverSubmitted > 0 ? responseCount / totalEverSubmitted : 0;
  const interviewRate =
    totalEverSubmitted > 0 ? interviewCount / totalEverSubmitted : 0;

  // Map recent matches
  const recentMatches = (matchesResult.data ?? []).map((m) => {
    const posting = m.job_postings as unknown as {
      id: string;
      company_name: string;
      company_logo_url: string | null;
      job_title: string;
      location: string | null;
      is_remote: boolean;
    };
    return {
      evaluationId: m.id,
      jobPostingId: posting.id,
      companyName: posting.company_name,
      companyLogoUrl: posting.company_logo_url,
      jobTitle: posting.job_title,
      location: posting.location,
      isRemote: posting.is_remote,
      overallScore: m.overall_score,
      recommendation: m.recommendation,
      evaluatedAt: m.evaluated_at,
    };
  });

  // Map recent activity
  const recentActivity = (activityResult.data ?? []).map((e) => {
    const app = e.applications as unknown as {
      profile_id: string;
      job_postings: { company_name: string; job_title: string };
    };
    return {
      id: e.id,
      eventType: e.event_type,
      description: e.description,
      metadata: e.metadata as Record<string, unknown> | null,
      createdAt: e.created_at,
      companyName: app?.job_postings?.company_name,
      jobTitle: app?.job_postings?.job_title,
    };
  });

  const lastRun = discoveryResult.data;

  return {
    data: {
      queueCount: queueResult.count ?? 0,
      applicationsThisPeriod:
        subscriptionResult.data?.applications_used ?? 0,
      applicationsLimit:
        subscriptionResult.data?.applications_limit ?? 5,
      totalSubmitted: totalEverSubmitted,
      responseRate,
      interviewRate,
      lastDiscoveryRun: lastRun
        ? {
            completedAt: lastRun.completed_at,
            jobsFound: lastRun.jobs_found,
            jobsMatched: lastRun.jobs_matched,
          }
        : null,
      nextDiscoveryAt: searchPrefsResult.data?.next_discovery_at ?? null,
      recentMatches,
      recentActivity,
    },
  };
}
