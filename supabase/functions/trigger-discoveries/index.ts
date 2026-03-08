import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { captureException } from "../_shared/sentry.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** Fallback discovery interval when discover-jobs fails (hours). */
const FALLBACK_INTERVAL_HOURS = 12;

/** Max concurrent discover-jobs invocations. */
const MAX_CONCURRENT_TRIGGERS = 5;

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
  const results: Array<{
    profile_id: string;
    status: string;
    error?: string;
  }> = [];

  try {
    // Find all users due for discovery
    const { data: duePrefs, error: queryError } = await supabase
      .from("search_preferences")
      .select("profile_id")
      .eq("is_active", true)
      .lte("next_discovery_at", new Date().toISOString());

    if (queryError) {
      return jsonResponse(
        {
          error: `Failed to query search preferences: ${queryError.message}`,
        },
        500
      );
    }

    if (!duePrefs || duePrefs.length === 0) {
      return jsonResponse({
        triggered: 0,
        results: [],
        message: "No users due for discovery",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Process users with bounded concurrency
    async function triggerUser(profileId: string) {
      try {
        const response = await fetch(
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

        if (!response.ok) {
          const errorBody = await response
            .text()
            .catch(() => "Unknown error");
          results.push({
            profile_id: profileId,
            status: "error",
            error: `HTTP ${response.status}: ${errorBody}`,
          });

          // Advance next_discovery_at to prevent retry storm
          await advanceNextDiscovery(profileId);
        } else {
          results.push({
            profile_id: profileId,
            status: "triggered",
          });
          // discover-jobs updates next_discovery_at on success with the correct tier interval
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          profile_id: profileId,
          status: "error",
          error: message,
        });
        captureException(err, {
          function: "trigger-discoveries",
          profileId,
        });

        // Advance next_discovery_at to prevent retry storm
        await advanceNextDiscovery(profileId);
      }
    }

    async function advanceNextDiscovery(profileId: string) {
      const nextAt = new Date(
        Date.now() + FALLBACK_INTERVAL_HOURS * 60 * 60 * 1000
      ).toISOString();
      await supabase
        .from("search_preferences")
        .update({ next_discovery_at: nextAt })
        .eq("profile_id", profileId);
    }

    // Run with bounded concurrency using worker pool
    const profileIds = duePrefs.map(
      (p: { profile_id: string }) => p.profile_id
    );
    let index = 0;

    async function runNext(): Promise<void> {
      while (index < profileIds.length) {
        // Safe: JS is single-threaded, increment before await
        const currentIndex = index++;
        await triggerUser(profileIds[currentIndex]);
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT_TRIGGERS, profileIds.length) },
      () => runNext()
    );
    await Promise.all(workers);

    return jsonResponse({
      triggered: results.filter((r) => r.status === "triggered").length,
      errors: results.filter((r) => r.status === "error").length,
      total: duePrefs.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureException(error, { function: "trigger-discoveries" });
    return jsonResponse({ error: message }, 500);
  }
});
