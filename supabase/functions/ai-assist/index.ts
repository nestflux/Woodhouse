import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { callClaude } from "../_shared/agent-call.ts";
import { captureException } from "../_shared/sentry.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const SkillSuggestionSchema = z.array(
  z.object({
    name: z.string(),
    category: z
      .enum([
        "technical",
        "soft",
        "language",
        "certification",
        "tool",
        "framework",
        "other",
      ])
      .optional()
      .default("other"),
    proficiency: z
      .enum(["beginner", "intermediate", "advanced", "expert"])
      .optional()
      .default("intermediate"),
  })
);

function getUserFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Generate Summary ───────────────────────────────────────────────────────

async function handleGenerateSummary(userId: string): Promise<Response> {
  const admin = getAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, headline, summary, country, location")
    .eq("id", userId)
    .single();

  const { data: experiences } = await admin
    .from("work_experiences")
    .select(
      "job_title, company_name, start_date, end_date, is_current, description, achievements(description)"
    )
    .eq("profile_id", userId)
    .order("start_date", { ascending: false });

  const { data: skills } = await admin
    .from("skills")
    .select("name, category, proficiency")
    .eq("profile_id", userId);

  const profileContext = JSON.stringify({
    name: profile?.full_name,
    headline: profile?.headline,
    country: profile?.country,
    location: profile?.location,
    work_experiences: experiences ?? [],
    skills: skills ?? [],
  });

  const result = await callClaude({
    agentType: "summary-generator",
    userId,
    model: "claude-sonnet-4-6",
    systemPrompt: `You are a professional resume writer. Generate a concise, compelling professional summary (2-3 sentences) based on the candidate's profile data.

The summary should:
- Lead with years of experience and primary expertise
- Highlight key skills and notable achievements
- Mention career goals or what they bring to a team
- Be written in first person implied (no "I" at the start, e.g., "Experienced software engineer with...")
- Be specific, not generic — use details from their actual work history

Return ONLY the summary text, no JSON, no quotes, no additional commentary.`,
    cacheableContext: profileContext,
    userMessage:
      "Generate a professional summary for this candidate based on their profile data.",
    maxTokens: 512,
    temperature: 0.7,
  });

  return jsonResponse({ suggestion: result.text.trim() });
}

// ─── Suggest Skills ─────────────────────────────────────────────────────────

async function handleSuggestSkills(userId: string): Promise<Response> {
  const admin = getAdminClient();

  const { data: experiences } = await admin
    .from("work_experiences")
    .select("job_title, company_name, description, achievements(description)")
    .eq("profile_id", userId);

  const { data: existingSkills } = await admin
    .from("skills")
    .select("name")
    .eq("profile_id", userId);

  const existingNames = (existingSkills ?? []).map((s: { name: string }) =>
    s.name.toLowerCase()
  );

  const result = await callClaude({
    agentType: "skill-suggester",
    userId,
    model: "claude-haiku-4-5",
    systemPrompt: `You are a career skills analyst. Analyze the candidate's work history and achievements to suggest skills they likely possess but haven't listed yet.

Return a JSON array of skill objects:
[
  {
    "name": "string — skill name",
    "category": "technical" | "soft" | "language" | "certification" | "tool" | "framework" | "other",
    "proficiency": "beginner" | "intermediate" | "advanced" | "expert"
  }
]

Rules:
- Suggest 5-15 skills based on the work history.
- Infer proficiency from experience duration and seniority.
- Include both technical and soft skills.
- Do NOT suggest skills the candidate already has (provided in the existing skills list).
- Return ONLY the JSON array, no additional text.`,
    userMessage: `Work history:\n${JSON.stringify(experiences ?? [])}\n\nExisting skills (do NOT re-suggest these):\n${existingNames.join(", ")}`,
    maxTokens: 1024,
    temperature: 0.3,
  });

  let rawSuggestions: unknown;
  try {
    let cleanText = result.text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }
    rawSuggestions = JSON.parse(cleanText);
  } catch {
    return jsonResponse({ error: "Failed to parse skill suggestions" }, 500);
  }

  const validated = SkillSuggestionSchema.safeParse(rawSuggestions);
  if (!validated.success) {
    return jsonResponse(
      { error: "Skill suggestions failed validation" },
      500
    );
  }

  return jsonResponse({ suggestions: validated.data });
}

// ─── Improve Achievement ────────────────────────────────────────────────────

async function handleImproveAchievement(
  userId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const achievementId = body.achievement_id as string;
  const description = body.description as string;
  const jobTitle = body.job_title as string | undefined;
  const companyName = body.company_name as string | undefined;

  if (!achievementId || !description) {
    return jsonResponse(
      { error: "achievement_id and description are required" },
      400
    );
  }

  const result = await callClaude({
    agentType: "achievement-improver",
    userId,
    model: "claude-sonnet-4-6",
    systemPrompt: `You are an expert resume writer specializing in achievement bullets. Rewrite the given achievement bullet to be more impactful and clear.

Rules:
- Start with a strong action verb (e.g., "Spearheaded", "Drove", "Architected", "Reduced")
- Include quantifiable metrics where possible (even if estimated, e.g., "~20% improvement")
- Follow the XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]"
- Keep it to one sentence, ideally under 150 characters
- Maintain truthfulness — do not fabricate metrics or outcomes that aren't implied by the original
- If context about the role/company is provided, use it to make the bullet more specific

Return ONLY the improved bullet text, no JSON, no quotes, no additional commentary.`,
    userMessage: `${jobTitle ? `Role: ${jobTitle}${companyName ? ` at ${companyName}` : ""}\n` : ""}Original achievement bullet:\n${description}`,
    maxTokens: 256,
    temperature: 0.7,
  });

  return jsonResponse({
    achievement_id: achievementId,
    suggestion: result.text.trim(),
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = body.action as string;

    switch (action) {
      case "generate_summary":
        return await handleGenerateSummary(user.id);
      case "suggest_skills":
        return await handleSuggestSkills(user.id);
      case "improve_achievement":
        return await handleImproveAchievement(user.id, body);
      default:
        return jsonResponse(
          {
            error: `Unknown action: ${action}. Valid actions: generate_summary, suggest_skills, improve_achievement`,
          },
          400
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureException(error, { function: "ai-assist" });
    return jsonResponse({ error: message }, 500);
  }
});
