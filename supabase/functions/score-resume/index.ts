import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callClaude } from "../_shared/agent-call.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { ResumeScoreSchema } from "../_shared/validators/resume-score.ts";
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

const SYSTEM_PROMPT = `You are an expert resume reviewer and ATS optimization specialist. Score the given resume across 6 dimensions and provide specific per-bullet improvement suggestions.

## Scoring Dimensions (each 0-100)

### 1. ATS Compatibility (weight: 20%)
- Standard section headings (Work Experience, Education, Skills — not creative/unusual names)
- No tables, columns, graphics, or special characters that confuse parsers
- Clean, consistent date formats
- Contact information present and properly formatted
- Standard fonts implied by content structure

### 2. Content Quality (weight: 20%)
- Achievement bullets start with strong action verbs (Led, Built, Drove, Reduced — not "Responsible for", "Worked on", "Helped with")
- Bullets follow STAR/XYZ format where possible: Accomplished [X] as measured by [Y] by doing [Z]
- Each bullet conveys a distinct contribution — no redundant or overlapping statements
- Professional summary is specific and relevant, not generic filler

### 3. Impact & Metrics (weight: 20%)
- Quantifiable outcomes present (percentages, dollar amounts, user counts, time saved)
- Metrics are specific and credible, not vague ("improved performance" without a number)
- Business impact is clear — what changed because of this work
- Ideally 60%+ of bullets include at least one metric

### 4. Brevity & Clarity (weight: 15%)
- Bullets are 1 sentence, ideally under 150 characters
- No filler words or passive voice
- Resume fits 1-2 pages worth of content (not 3+)
- No paragraphs in experience sections (bullets only)
- Summary is 2-3 sentences max

### 5. Keyword Optimization (weight: 15%)
- Technical skills are specifically named (not "various programming languages")
- Industry-standard terminology is used
- Skills section includes both tools and methodologies
- Keywords from the role area are present naturally throughout

### 6. Section Completeness (weight: 10%)
- Has: contact info, summary, work experience, education, skills
- Optional but valuable: projects, certifications
- Work experience has company name, title, dates, location for each entry
- Education has institution, degree, field, dates

## Output Format
Return a JSON object:
{
  "overall_score": number (0-100, weighted average of dimensions),
  "dimensions": {
    "ats_compatibility": { "score": number, "feedback": "string — 1-2 sentences" },
    "content_quality": { "score": number, "feedback": "string" },
    "impact_metrics": { "score": number, "feedback": "string" },
    "brevity_clarity": { "score": number, "feedback": "string" },
    "keyword_optimization": { "score": number, "feedback": "string" },
    "section_completeness": { "score": number, "feedback": "string" }
  },
  "suggestions": [
    {
      "section": "work_experience" | "summary" | "skills" | "education" | "projects" | "certifications" | "header",
      "experience_index": number | null,
      "bullet_index": number | null,
      "original": "string — the original text",
      "suggested": "string — the improved text",
      "reason": "string — why this change improves the resume",
      "priority": "high" | "medium" | "low"
    }
  ],
  "general_feedback": ["string — general observations and recommendations"]
}

Rules:
- Be specific in suggestions. Show exact before/after text.
- Prioritize high-impact suggestions first (weak action verbs, missing metrics).
- For bullets with no metrics, suggest a plausible metric placeholder like "~X%" that the user can fill in.
- Include at most 25 suggestions to avoid overwhelming the user.
- general_feedback should be 3-5 items covering broad themes.
- Return ONLY the JSON object, no additional text.`;

// Dimension weights for computing the weighted average
const DIMENSION_WEIGHTS: Record<string, number> = {
  ats_compatibility: 0.2,
  content_quality: 0.2,
  impact_metrics: 0.2,
  brevity_clarity: 0.15,
  keyword_optimization: 0.15,
  section_completeness: 0.1,
};

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

    if (!userResumeId) {
      return jsonResponse({ error: "user_resume_id is required" }, 400);
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
      return jsonResponse({ error: "Resume has no content to score" }, 400);
    }

    // Call Claude for scoring
    const result = await callClaude({
      agentType: "score_resume",
      userId: user.id,
      model: "claude-sonnet-4-6",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Score the following resume:\n\n${JSON.stringify(content, null, 2)}`,
      maxTokens: 8192,
      temperature: 0.3,
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
      captureMessage("score-resume: Invalid JSON from Claude", {
        userId: user.id,
        resumeId: userResumeId,
      });
      return jsonResponse(
        { error: "AI returned invalid JSON — please retry" },
        500
      );
    }

    const validated = ResumeScoreSchema.safeParse(parsed);
    if (!validated.success) {
      captureMessage("score-resume: Zod validation failed", {
        userId: user.id,
        resumeId: userResumeId,
        error: validated.error.message,
      });
      return jsonResponse(
        { error: "AI output validation failed — please retry" },
        500
      );
    }

    const scoreData = validated.data;

    // Compute weighted overall score (override AI's calculation for consistency)
    const weightedScore = Math.round(
      Object.entries(scoreData.dimensions).reduce((sum, [key, dim]) => {
        return sum + dim.score * (DIMENSION_WEIGHTS[key] ?? 0);
      }, 0)
    );

    // Build scoring breakdown for storage
    const scoringBreakdown = {
      dimensions: Object.fromEntries(
        Object.entries(scoreData.dimensions).map(([key, dim]) => [
          key,
          { score: dim.score, max: 100, feedback: dim.feedback },
        ])
      ),
      suggestions: scoreData.suggestions,
      general_feedback: scoreData.general_feedback,
    };

    // Write score to DB
    const { error: updateError } = await admin
      .from("user_resumes")
      .update({
        overall_score: weightedScore,
        scoring_breakdown: scoringBreakdown,
        status: "scored",
        error: null,
      })
      .eq("id", userResumeId);

    if (updateError) {
      return jsonResponse(
        { error: `Failed to save score: ${updateError.message}` },
        500
      );
    }

    return jsonResponse({
      overall_score: weightedScore,
      scoring_breakdown: scoringBreakdown,
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        cache_read_tokens: result.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureException(error, { function: "score-resume" });
    return jsonResponse({ error: message }, 500);
  }
});
