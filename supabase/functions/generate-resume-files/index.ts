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

  let body: Record<string, unknown>;
  try {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const supabase = getSupabaseAdmin();

  // Auth — verify the user
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  // Determine input mode: direct content (resume builder) vs resume_version_id (tailoring)
  const userResumeId = body.user_resume_id as string | undefined;
  const resumeVersionId = body.resume_version_id as string | undefined;
  const formats = (body.formats as string[] | undefined) ?? ["pdf", "docx"];

  if (!userResumeId && !resumeVersionId) {
    return jsonResponse({ error: "user_resume_id or resume_version_id is required" }, 400);
  }

  try {
    if (userResumeId) {
      // Resume Builder mode — load content from user_resumes
      const { data: ur, error: urError } = await supabase
        .from("user_resumes")
        .select("content, profile_id")
        .eq("id", userResumeId)
        .eq("profile_id", user.id)
        .single();

      if (urError || !ur) {
        return jsonResponse({ error: "Resume not found" }, 404);
      }

      const result = await generateResumeFiles({
        profileId: ur.profile_id,
        userResumeId,
        directContent: ur.content,
        formats: formats as ("pdf" | "docx")[],
      });

      return jsonResponse({
        user_resume_id: userResumeId,
        pdf_url: result.pdfUrl,
        docx_url: result.docxUrl,
      });
    } else {
      // Tailoring mode — existing behavior
      const { data: rv, error: rvError } = await supabase
        .from("resume_versions")
        .select("profile_id")
        .eq("id", resumeVersionId!)
        .single();

      if (rvError || !rv) {
        return jsonResponse({ error: `Resume version not found: ${rvError?.message ?? "Not found"}` }, 404);
      }

      const result = await generateResumeFiles({
        resumeVersionId: resumeVersionId!,
        profileId: rv.profile_id,
      });

      return jsonResponse({
        resume_version_id: resumeVersionId,
        pdf_url: result.pdfUrl,
        docx_url: result.docxUrl,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error instanceof RetryableError ? 503 : 500;
    captureException(error, {
      function: "generate-resume-files",
      userResumeId,
      resumeVersionId,
      profileId: user.id,
    });
    return jsonResponse({ error: message, retryable: statusCode === 503 }, statusCode);
  }
});
