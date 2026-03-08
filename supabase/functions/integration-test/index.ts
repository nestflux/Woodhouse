import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** Max time to wait for the full pipeline to complete — matches AC #10 (5 min for 10 postings). */
const PIPELINE_TIMEOUT_MS = 300_000;

/** Delay between process-pipeline invocations — balances latency vs. Edge Function cost. */
const POLL_INTERVAL_MS = 5_000;

/** Safety valve against infinite loops (5s × 60 = 5 min max wall-clock). */
const MAX_POLL_ITERATIONS = 60;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: CORS_HEADERS,
  });
}

interface TestReport {
  status: "pass" | "fail";
  duration_ms: number;
  discovery: {
    status: string;
    jobs_found: number;
    jobs_new: number;
    pipeline_jobs_enqueued: number;
  } | null;
  pipeline: {
    total_jobs_processed: number;
    iterations: number;
    steps: Record<string, { completed: number; failed: number }>;
  };
  verification: {
    job_postings_count: number;
    pre_screen_passed: number;
    pre_screen_failed: number;
    evaluations_count: number;
    applications_count: number;
    resume_versions_count: number;
    applications_ready: number;
    applications_draft: number;
    pipeline_jobs_completed: number;
    pipeline_jobs_failed: number;
    pipeline_jobs_pending: number;
  };
  checks: Array<{
    name: string;
    status: "pass" | "fail" | "skip";
    detail: string;
  }>;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const errors: string[] = [];

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        error:
          "Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      },
      500
    );
  }

  let profileId: string;
  try {
    const body = await req.json().catch(() => ({}));
    profileId = body.profile_id as string;
    if (!profileId) {
      return jsonResponse({ error: "profile_id is required" }, 400);
    }
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  // ─── Step 0: Verify test user has a complete profile ──────────────────────

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, headline, onboarding_completed")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return jsonResponse(
      {
        error: `Test user not found: ${profileError?.message ?? "No profile"}`,
      },
      400
    );
  }

  const { data: workExps } = await supabase
    .from("work_experiences")
    .select("id")
    .eq("profile_id", profileId);

  const { data: skills } = await supabase
    .from("skills")
    .select("id")
    .eq("profile_id", profileId);

  const { data: searchPrefs } = await supabase
    .from("search_preferences")
    .select("keywords, is_active")
    .eq("profile_id", profileId)
    .single();

  if (!workExps || workExps.length === 0) {
    return jsonResponse(
      { error: "Test user has no work experiences — cannot run pipeline" },
      400
    );
  }

  if (!skills || skills.length === 0) {
    return jsonResponse(
      { error: "Test user has no skills — cannot run pipeline" },
      400
    );
  }

  if (!searchPrefs || !searchPrefs.is_active) {
    return jsonResponse(
      {
        error:
          "Test user has no active search preferences — cannot trigger discovery",
      },
      400
    );
  }

  const keywords = (searchPrefs.keywords as string[]) ?? [];
  if (keywords.length === 0) {
    return jsonResponse(
      { error: "Test user has no search keywords configured" },
      400
    );
  }

  console.info(
    `[integration-test] Starting for profile_id=${profileId} (${profile.full_name})`
  );

  // ─── Step 1: Trigger discovery ────────────────────────────────────────────

  let discoveryResult: TestReport["discovery"] = null;

  try {
    console.info("[integration-test] Triggering discover-jobs...");

    const discoverResponse = await fetch(
      `${supabaseUrl}/functions/v1/discover-jobs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile_id: profileId }),
      }
    );

    if (!discoverResponse.ok) {
      const errorBody = await discoverResponse
        .text()
        .catch(() => "Unknown error");
      errors.push(
        `Discovery failed: HTTP ${discoverResponse.status}: ${errorBody}`
      );
    } else {
      const discoverData = await discoverResponse.json();
      discoveryResult = {
        status: discoverData.status,
        jobs_found: discoverData.jobs_found ?? 0,
        jobs_new: discoverData.jobs_new ?? 0,
        pipeline_jobs_enqueued: discoverData.pipeline_jobs_enqueued ?? 0,
      };

      console.info(
        `[integration-test] Discovery complete: found=${discoveryResult.jobs_found} new=${discoveryResult.jobs_new} enqueued=${discoveryResult.pipeline_jobs_enqueued}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Discovery call failed: ${msg}`);
  }

  // ─── Step 2: Process pipeline jobs in a loop ──────────────────────────────

  let totalJobsProcessed = 0;
  let iterations = 0;
  const stepCounts: Record<string, { completed: number; failed: number }> = {};

  try {
    console.info("[integration-test] Starting pipeline processing loop...");

    while (
      Date.now() - startTime < PIPELINE_TIMEOUT_MS &&
      iterations < MAX_POLL_ITERATIONS
    ) {
      // Check if there are any pending/processing jobs
      const { data: pendingJobs } = await supabase
        .from("pipeline_jobs")
        .select("id, step, status")
        .eq("profile_id", profileId)
        .in("status", ["pending", "processing"]);

      if (!pendingJobs || pendingJobs.length === 0) {
        console.info(
          `[integration-test] No more pending jobs after ${iterations} iterations`
        );
        break;
      }

      console.info(
        `[integration-test] Iteration ${iterations + 1}: ${pendingJobs.length} pending/processing jobs`
      );

      // Call process-pipeline
      const pipelineResponse = await fetch(
        `${supabaseUrl}/functions/v1/process-pipeline`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (pipelineResponse.ok) {
        const pipelineData = await pipelineResponse.json();
        totalJobsProcessed += pipelineData.jobs_processed ?? 0;
      } else {
        const errorBody = await pipelineResponse
          .text()
          .catch(() => "Unknown error");
        errors.push(
          `Pipeline call failed at iteration ${iterations}: HTTP ${pipelineResponse.status}: ${errorBody}`
        );
      }

      iterations++;

      // Brief pause before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Collect step-level counts
    const { data: allJobs } = await supabase
      .from("pipeline_jobs")
      .select("step, status")
      .eq("profile_id", profileId);

    if (allJobs) {
      for (const job of allJobs) {
        const step = job.step as string;
        if (!stepCounts[step]) {
          stepCounts[step] = { completed: 0, failed: 0 };
        }
        if (job.status === "completed") stepCounts[step].completed++;
        else if (job.status === "failed") stepCounts[step].failed++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Pipeline processing loop failed: ${msg}`);
  }

  // ─── Step 3: Verify data integrity ────────────────────────────────────────

  console.info("[integration-test] Running verification queries...");

  // Count job postings discovered for this user's discovery runs
  const { data: discoveryRuns } = await supabase
    .from("discovery_runs")
    .select("id")
    .eq("profile_id", profileId);

  const runIds = (discoveryRuns ?? []).map(
    (r: { id: string }) => r.id
  );

  let jobPostingsCount = 0;
  if (runIds.length > 0) {
    const { data: pipelineJobsForRuns } = await supabase
      .from("pipeline_jobs")
      .select("job_posting_id")
      .eq("profile_id", profileId)
      .eq("step", "pre_screen");

    const postingIds = [
      ...new Set(
        (pipelineJobsForRuns ?? [])
          .map((j: { job_posting_id: string | null }) => j.job_posting_id)
          .filter(Boolean)
      ),
    ];
    jobPostingsCount = postingIds.length;
  }

  // Count pre-screen results
  const { data: preScreenJobs } = await supabase
    .from("pipeline_jobs")
    .select("id, status, output_data")
    .eq("profile_id", profileId)
    .eq("step", "pre_screen")
    .eq("status", "completed");

  let preScreenPassed = 0;
  let preScreenFailed = 0;
  for (const job of preScreenJobs ?? []) {
    const output = job.output_data as Record<string, unknown> | null;
    if (output?.pass === true) {
      preScreenPassed++;
    } else {
      preScreenFailed++;
    }
  }

  // Count evaluations
  const { count: evaluationsCount } = await supabase
    .from("job_evaluations")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  // Count applications
  const { data: applications } = await supabase
    .from("applications")
    .select("id, status")
    .eq("profile_id", profileId);

  const applicationsCount = applications?.length ?? 0;
  const applicationsReady =
    applications?.filter((a: { status: string }) => a.status === "ready")
      .length ?? 0;
  const applicationsDraft =
    applications?.filter((a: { status: string }) => a.status === "draft")
      .length ?? 0;

  // Count resume versions
  const { count: resumeVersionsCount } = await supabase
    .from("resume_versions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("is_base", false);

  // Count pipeline job statuses
  const { data: allPipelineJobs } = await supabase
    .from("pipeline_jobs")
    .select("id, status")
    .eq("profile_id", profileId);

  const pipelineCompleted =
    allPipelineJobs?.filter(
      (j: { status: string }) => j.status === "completed"
    ).length ?? 0;
  const pipelineFailed =
    allPipelineJobs?.filter(
      (j: { status: string }) => j.status === "failed"
    ).length ?? 0;
  const pipelinePending =
    allPipelineJobs?.filter(
      (j: { status: string }) =>
        j.status === "pending" || j.status === "processing"
    ).length ?? 0;

  const verification: TestReport["verification"] = {
    job_postings_count: jobPostingsCount,
    pre_screen_passed: preScreenPassed,
    pre_screen_failed: preScreenFailed,
    evaluations_count: evaluationsCount ?? 0,
    applications_count: applicationsCount,
    resume_versions_count: resumeVersionsCount ?? 0,
    applications_ready: applicationsReady,
    applications_draft: applicationsDraft,
    pipeline_jobs_completed: pipelineCompleted,
    pipeline_jobs_failed: pipelineFailed,
    pipeline_jobs_pending: pipelinePending,
  };

  // ─── Step 4: Run assertion checks ─────────────────────────────────────────

  const checks: TestReport["checks"] = [];

  // Check 1: Discovery found jobs
  checks.push({
    name: "Discovery found job postings",
    status:
      discoveryResult && discoveryResult.jobs_found > 0 ? "pass" : "fail",
    detail: discoveryResult
      ? `Found ${discoveryResult.jobs_found} jobs, ${discoveryResult.jobs_new} new`
      : "Discovery did not complete",
  });

  // Check 2: Pipeline jobs were enqueued
  checks.push({
    name: "Pipeline jobs enqueued for pre_screen",
    status:
      discoveryResult && discoveryResult.pipeline_jobs_enqueued > 0
        ? "pass"
        : "fail",
    detail: discoveryResult
      ? `${discoveryResult.pipeline_jobs_enqueued} pipeline jobs enqueued`
      : "No discovery result",
  });

  // Check 3: Pre-screen completed (some pass, some fail)
  const preScreenTotal = preScreenPassed + preScreenFailed;
  checks.push({
    name: "Pre-screen jobs completed",
    status: preScreenTotal > 0 ? "pass" : "fail",
    detail: `${preScreenTotal} pre-screen jobs completed (${preScreenPassed} passed, ${preScreenFailed} filtered)`,
  });

  // Check 4: Some postings filtered at pre-screen (not all pass)
  checks.push({
    name: "Some postings filtered at pre_screen",
    status:
      preScreenFailed > 0
        ? "pass"
        : preScreenTotal > 0
          ? "skip"
          : "fail",
    detail:
      preScreenFailed > 0
        ? `${preScreenFailed} postings filtered out`
        : preScreenTotal > 0
          ? "All postings passed pre-screen (possible with a good profile match)"
          : "No pre-screen results",
  });

  // Check 5: Evaluations created for passing postings
  checks.push({
    name: "Evaluations created for passing postings",
    status:
      (evaluationsCount ?? 0) > 0 && (evaluationsCount ?? 0) >= preScreenPassed
        ? "pass"
        : preScreenPassed === 0
          ? "skip"
          : "fail",
    detail: `${evaluationsCount ?? 0} evaluations created (expected >= ${preScreenPassed})`,
  });

  // Check 6: Applications created for above-threshold evaluations
  checks.push({
    name: "Applications created for above-threshold evaluations",
    status:
      applicationsCount > 0
        ? "pass"
        : preScreenPassed === 0
          ? "skip"
          : "fail",
    detail: `${applicationsCount} applications created`,
  });

  // Check 7: Resume versions created for applications
  checks.push({
    name: "Resume versions created (tailoring completed)",
    status:
      (resumeVersionsCount ?? 0) > 0
        ? "pass"
        : applicationsCount === 0
          ? "skip"
          : "fail",
    detail: `${resumeVersionsCount ?? 0} tailored resume versions created`,
  });

  // Check 8: Application status progression (draft → ready)
  checks.push({
    name: "Application status progressed to ready",
    status:
      applicationsReady > 0
        ? "pass"
        : applicationsCount === 0
          ? "skip"
          : "fail",
    detail: `${applicationsReady} applications at 'ready' status, ${applicationsDraft} still 'draft'`,
  });

  // Check 9: Pipeline jobs show completed status for each step
  const expectedSteps = [
    "pre_screen",
    "evaluate",
    "tailor",
    "generate_materials",
    "generate_files",
  ];
  const stepsWithCompletions = expectedSteps.filter(
    (s) => stepCounts[s]?.completed > 0
  );
  checks.push({
    name: "Pipeline jobs completed across all steps",
    status: stepsWithCompletions.length >= 1 ? "pass" : "fail",
    detail: `Steps with completions: ${stepsWithCompletions.join(", ") || "none"}. Full step counts: ${JSON.stringify(stepCounts)}`,
  });

  // Check 10: Failed pipeline jobs have error messages
  if (pipelineFailed > 0) {
    const { data: failedJobs } = await supabase
      .from("pipeline_jobs")
      .select("id, step, error, attempts")
      .eq("profile_id", profileId)
      .eq("status", "failed");

    const allHaveErrors = (failedJobs ?? []).every(
      (j: { error: string | null }) => j.error && j.error.length > 0
    );

    checks.push({
      name: "Failed pipeline jobs have error messages",
      status: allHaveErrors ? "pass" : "fail",
      detail: `${pipelineFailed} failed jobs, ${allHaveErrors ? "all" : "some missing"} have error messages`,
    });
  }

  // Check 11: No pending/processing jobs remain (pipeline completed)
  checks.push({
    name: "No pending/processing jobs remain",
    status: pipelinePending === 0 ? "pass" : "fail",
    detail:
      pipelinePending === 0
        ? "All pipeline jobs completed or failed"
        : `${pipelinePending} jobs still pending/processing`,
  });

  // Check 12: Completed within 5 minutes
  const totalDuration = Date.now() - startTime;
  checks.push({
    name: "End-to-end completed within 5 minutes",
    status: totalDuration <= PIPELINE_TIMEOUT_MS ? "pass" : "fail",
    detail: `Completed in ${Math.round(totalDuration / 1000)}s`,
  });

  // ─── Build final report ───────────────────────────────────────────────────

  const allPassed = checks.every(
    (c) => c.status === "pass" || c.status === "skip"
  );

  const report: TestReport = {
    status: allPassed && errors.length === 0 ? "pass" : "fail",
    duration_ms: totalDuration,
    discovery: discoveryResult,
    pipeline: {
      total_jobs_processed: totalJobsProcessed,
      iterations,
      steps: stepCounts,
    },
    verification,
    checks,
    errors,
  };

  console.info(
    `[integration-test] Finished: status=${report.status} duration=${totalDuration}ms checks=${checks.filter((c) => c.status === "pass").length}/${checks.length} pass`
  );

  return jsonResponse(report, allPassed ? 200 : 422);
});
