import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { generateResumeFiles } from "../_shared/file-generation/index.ts";
import { RetryableError } from "../_shared/agent-call.ts";
import { captureException } from "../_shared/sentry.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
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

  let resumeVersionId: string;
  try {
    const body = await req.json().catch(() => ({}));
    resumeVersionId = body.resume_version_id as string;
    if (!resumeVersionId) {
      return jsonResponse({ error: "resume_version_id is required" }, 400);
    }
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const supabase = getSupabaseAdmin();

  // Look up the resume version to get profile_id
  const { data: rv, error: rvError } = await supabase
    .from("resume_versions")
    .select("profile_id")
    .eq("id", resumeVersionId)
    .single();

  if (rvError || !rv) {
    return jsonResponse(
      {
        error: `Resume version not found: ${rvError?.message ?? "Not found"}`,
      },
      404
    );
  }

  try {
    const result = await generateResumeFiles({
      resumeVersionId,
      profileId: rv.profile_id,
    });

    return jsonResponse({
      resume_version_id: resumeVersionId,
      pdf_url: result.pdfUrl,
      docx_url: result.docxUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error instanceof RetryableError ? 503 : 500;
    captureException(error, {
      function: "generate-resume-files",
      resumeVersionId,
      profileId: rv.profile_id,
    });
    return jsonResponse({ error: message, retryable: statusCode === 503 }, statusCode);
  }
});
