import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { runDiscovery } from "../_shared/agents/discovery.ts";
import { captureException } from "../_shared/sentry.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** Discovery frequency by subscription plan (in hours). */
const DISCOVERY_INTERVAL_HOURS: Record<string, number> = {
  free: 12,
  pro: 6,
  premium: 1,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
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

  const supabase = getSupabaseAdmin();

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

  // Create discovery_runs record
  const { data: discoveryRun, error: runError } = await supabase
    .from("discovery_runs")
    .insert({
      profile_id: profileId,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runError || !discoveryRun) {
    return jsonResponse(
      { error: `Failed to create discovery run: ${runError?.message}` },
      500
    );
  }

  const runId = discoveryRun.id;

  try {
    // Read user's search preferences
    const { data: prefs } = await supabase
      .from("search_preferences")
      .select(
        "keywords, excluded_keywords, excluded_companies, job_types, is_active"
      )
      .eq("profile_id", profileId)
      .single();

    if (!prefs || !prefs.is_active) {
      await supabase
        .from("discovery_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error: prefs
            ? "Discovery is paused"
            : "No search preferences found",
        })
        .eq("id", runId);

      return jsonResponse({
        discovery_run_id: runId,
        status: "skipped",
        reason: prefs
          ? "Discovery is paused"
          : "No search preferences configured",
      });
    }

    // Read user profile for target locations/countries
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_locations, target_countries")
      .eq("id", profileId)
      .single();

    const queries = (prefs.keywords as string[]) ?? [];
    if (queries.length === 0) {
      await supabase
        .from("discovery_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error: "No search keywords configured",
        })
        .eq("id", runId);

      return jsonResponse({
        discovery_run_id: runId,
        status: "skipped",
        reason: "No search keywords configured",
      });
    }

    const locations = (profile?.target_locations as string[]) ?? [];
    const countries = (profile?.target_countries as string[]) ?? [];
    const jobTypes = (prefs.job_types as string[]) ?? [];
    const excludedKeywords = (prefs.excluded_keywords as string[]) ?? [];
    const excludedCompanies = (prefs.excluded_companies as string[]) ?? [];

    // Run discovery
    const result = await runDiscovery({
      userId: profileId,
      queries,
      locations,
      countries,
      jobTypes,
      excludedKeywords,
      excludedCompanies,
    });

    // Determine which sources were scanned
    const sourcesScanned = ["google_jobs", "jsearch"];
    const { data: boards } = await supabase
      .from("tracked_boards")
      .select("platform")
      .eq("profile_id", profileId)
      .eq("is_active", true);

    if (boards && boards.length > 0) {
      const platforms = [
        ...new Set(boards.map((b: { platform: string }) => b.platform)),
      ];
      sourcesScanned.push(...platforms);
    }

    // Enqueue pre_screen pipeline jobs for each newly saved posting
    let enqueuedCount = 0;
    if (result.savedIds.length > 0) {
      const pipelineRows = result.savedIds.map((postingId) => ({
        profile_id: profileId,
        job_posting_id: postingId,
        discovery_run_id: runId,
        step: "pre_screen",
        status: "pending",
      }));

      const { error: enqueueError } = await supabase
        .from("pipeline_jobs")
        .insert(pipelineRows);

      if (enqueueError) {
        captureException(new Error(enqueueError.message), {
          phase: "enqueue-pre-screen",
          runId,
          profileId,
          count: pipelineRows.length,
        });
      } else {
        enqueuedCount = pipelineRows.length;
      }
    }

    // Update discovery run with results
    await supabase
      .from("discovery_runs")
      .update({
        status: "completed",
        sources_scanned: sourcesScanned,
        jobs_found: result.totalFetched,
        jobs_new: result.saved,
        completed_at: new Date().toISOString(),
        error: result.errors.length > 0 ? result.errors.join("; ") : null,
      })
      .eq("id", runId);

    // Update next_discovery_at based on subscription tier
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("profile_id", profileId)
      .single();

    const plan = subscription?.plan ?? "free";
    const intervalHours = DISCOVERY_INTERVAL_HOURS[plan] ?? 12;
    const nextDiscoveryAt = new Date(
      Date.now() + intervalHours * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("search_preferences")
      .update({ next_discovery_at: nextDiscoveryAt })
      .eq("profile_id", profileId);

    return jsonResponse({
      discovery_run_id: runId,
      status: "completed",
      jobs_found: result.totalFetched,
      jobs_new: result.saved,
      duplicates_skipped: result.duplicatesSkipped,
      pipeline_jobs_enqueued: enqueuedCount,
      next_discovery_at: nextDiscoveryAt,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Update discovery run as failed
    await supabase
      .from("discovery_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", runId);

    captureException(error, {
      function: "discover-jobs",
      profileId,
      runId,
    });

    return jsonResponse({ error: message, discovery_run_id: runId }, 500);
  }
});
