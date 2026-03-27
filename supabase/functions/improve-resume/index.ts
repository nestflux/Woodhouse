import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callClaude } from "../_shared/agent-call.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { ResumeImprovementSchema } from "../_shared/validators/resume-improvement.ts";
import { captureException, captureMessage } from "../_shared/sentry.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function getUserFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

// ─── System Prompts ──────────────────────────────────────────────────────────

const SHARED_OUTPUT_FORMAT = `
## Output Format
Return a JSON object with three fields:
{
  "improved_content": { /* Full resume in the same structure as the input */ },
  "changes": [
    {
      "section": "work_experience" | "summary" | "skills" | "education" | "projects" | "certifications" | "header",
      "experience_index": number | null,
      "bullet_index": number | null,
      "field": "string — path to changed field, e.g. 'work_experience[0].achievements[2].text' or 'summary'",
      "original": "string — the original text before change",
      "improved": "string — the new text after change"
    }
  ],
  "change_summary": "string — 2-3 sentences describing what was changed overall and why"
}

Rules:
- Return the COMPLETE improved_content (all sections, not just changed parts).
- Preserve all source_id values unchanged from the input.
- Track EVERY change in the changes array — no silent modifications.
- Return ONLY the JSON object, no additional text.`;

const AUTO_PROMPT = `You are an expert resume writer. Improve the given resume based on ATS best practices.

Improvement rules:
- Start every achievement bullet with a strong action verb (e.g., Spearheaded, Architected, Reduced, Drove)
- Replace weak openers like "Responsible for", "Worked on", "Helped with" with impact-driven phrasing
- Add quantifiable metrics where the context implies them (use ~X% or ~X format as placeholders if exact numbers are not available)
- Follow XYZ format: Accomplished [X] as measured by [Y] by doing [Z]
- Keep bullets under 150 characters
- Eliminate passive voice and filler words
- Improve the professional summary to be specific and compelling (2-3 sentences)
- Do NOT change factual information (company names, job titles, dates, institutions, degrees)
- Do NOT add experiences, skills, or achievements not present in the original
- Do NOT remove any work experience entries or education entries
${SHARED_OUTPUT_FORMAT}`;

const REFERENCE_PROMPT = `You are an expert resume writer. The user wants to improve their resume using another resume as a style and content guide.

You will receive:
1. The user's current resume (to improve)
2. A reference resume (to use as a style/format/content guide)

Improvement rules:
- Adopt the formatting style, tone, and bullet structure of the reference resume
- Apply the reference resume's action verb patterns and metrics style to the user's content
- Mirror the reference resume's section ordering and summary style
- Do NOT copy any content (achievements, skills, company names) from the reference resume — only its style
- Do NOT change factual information in the user's resume (company names, titles, dates, institutions)
- Do NOT add fabricated experiences or skills
- Keep the user's actual experiences, skills, and achievements
${SHARED_OUTPUT_FORMAT}`;

const CUSTOM_PROMPT = `You are an expert resume writer. Improve the given resume according to the user's custom instructions provided in the user message.

Improvement rules:
- Follow the user's instructions as closely as possible
- Do NOT change factual information (company names, titles, dates) unless the user explicitly asks
- Do NOT add fabricated experiences or skills
- If the user asks to condense, prioritize removing less impactful bullets rather than entire experiences
- If the user asks to focus on a specific area, emphasize relevant achievements and skills
${SHARED_OUTPUT_FORMAT}`;

// ─── Main Handler ────────────────────────────────────────────────────────────

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

  try {
    const token = getUserFromRequest(req);
    if (!token) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const admin = getSupabaseAdmin();
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const userResumeId = body.user_resume_id as string;
    const mode = body.mode as string;

    if (!userResumeId) {
      return jsonResponse({ error: "user_resume_id is required" }, 400);
    }
    if (!mode || !["auto", "reference", "custom"].includes(mode)) {
      return jsonResponse(
        { error: 'mode is required: "auto", "reference", or "custom"' },
        400
      );
    }

    // Load resume content
    const { data: resume, error: fetchError } = await admin
      .from("user_resumes")
      .select("id, profile_id, content")
      .eq("id", userResumeId)
      .single();

    if (fetchError || !resume) {
      return jsonResponse({ error: "Resume not found" }, 404);
    }

    if (resume.profile_id !== user.id) {
      return jsonResponse({ error: "Access denied" }, 403);
    }

    const content = resume.content;
    if (!content || Object.keys(content).length === 0) {
      return jsonResponse({ error: "Resume has no content to improve" }, 400);
    }

    // Check plan for reference/custom modes
    if (mode === "reference" || mode === "custom") {
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("plan")
        .eq("profile_id", user.id)
        .single();

      const plan = subscription?.plan ?? "free";
      if (plan === "free") {
        return jsonResponse(
          {
            error:
              "Reference and custom improvement modes require a Pro or Premium plan. Upgrade to unlock.",
          },
          403
        );
      }
    }

    // Build system prompt and user message based on mode
    let systemPrompt: string;
    let userMessage: string;
    let temperature: number;

    switch (mode) {
      case "auto":
        systemPrompt = AUTO_PROMPT;
        userMessage = `Improve this resume:\n\n${JSON.stringify(content, null, 2)}`;
        temperature = 0.3;
        break;

      case "reference": {
        const referenceContent = body.reference_resume_content;
        if (!referenceContent) {
          return jsonResponse(
            { error: "reference_resume_content is required for reference mode" },
            400
          );
        }
        systemPrompt = REFERENCE_PROMPT;
        userMessage = `## User's Resume (to improve)\n${JSON.stringify(content, null, 2)}\n\n## Reference Resume (style guide only)\n${JSON.stringify(referenceContent, null, 2)}`;
        temperature = 0.5;
        break;
      }

      case "custom": {
        const customPrompt = body.custom_prompt as string;
        if (!customPrompt || customPrompt.trim().length === 0) {
          return jsonResponse(
            { error: "custom_prompt is required for custom mode" },
            400
          );
        }
        if (customPrompt.length > 2000) {
          return jsonResponse(
            { error: "custom_prompt must be 2000 characters or less" },
            400
          );
        }
        systemPrompt = CUSTOM_PROMPT;
        userMessage = `## Custom Instructions\n${customPrompt.trim()}\n\n## Resume to Improve\n${JSON.stringify(content, null, 2)}`;
        temperature = 0.5;
        break;
      }

      default:
        return jsonResponse({ error: "Invalid mode" }, 400);
    }

    // Call Claude
    const result = await callClaude({
      agentType: "improve_resume",
      userId: user.id,
      model: "claude-sonnet-4-6",
      systemPrompt,
      userMessage,
      maxTokens: 8192,
      temperature,
    });

    // Parse and validate output
    let cleanText = result.text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      captureMessage("improve-resume: Invalid JSON from Claude", {
        userId: user.id,
        resumeId: userResumeId,
        mode,
      });
      return jsonResponse(
        { error: "AI returned invalid JSON — please retry" },
        500
      );
    }

    const validated = ResumeImprovementSchema.safeParse(parsed);
    if (!validated.success) {
      captureMessage("improve-resume: Zod validation failed", {
        userId: user.id,
        resumeId: userResumeId,
        mode,
        error: validated.error.message,
      });
      return jsonResponse(
        { error: "AI output validation failed — please retry" },
        500
      );
    }

    // Return the improvement (do NOT auto-save — frontend handles review/apply)
    return jsonResponse({
      improved_content: validated.data.improved_content,
      changes: validated.data.changes,
      change_summary: validated.data.change_summary,
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        cache_read_tokens: result.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureException(error, { function: "improve-resume" });
    return jsonResponse({ error: message }, 500);
  }
});
