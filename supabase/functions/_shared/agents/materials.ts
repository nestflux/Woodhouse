import { callClaude, RetryableError } from "../agent-call.ts";
import { getSupabaseAdmin } from "../supabase.ts";
import { MaterialsSchema } from "../validators/materials.ts";
import { captureMessage } from "../sentry.ts";
import type { Materials } from "../validators/materials.ts";

// ─── Call 1: Sonnet — Cover Letter + Why Interested ──────────────────────────

const SONNET_SYSTEM_PROMPT = `You are a professional cover letter and application writer. Generate a compelling cover letter and a "Why are you interested in this role?" answer.

## Truthfulness Constraint
You may ONLY reference experiences, skills, achievements, and qualifications that appear in the provided candidate data (tailored resume and evaluation results). Do not invent, fabricate, or embellish any claims. Every specific example in the cover letter must be traceable to the provided context.

## Cover Letter Rules
- 3-4 paragraphs maximum
- First paragraph: why this company/role specifically (not generic — reference the company name, what they do, and why it appeals to this candidate)
- Middle paragraphs: 2-3 specific examples from the user's experience that map to the role's key requirements. Reference actual achievements, metrics, and technologies from the tailored resume.
- Final paragraph: call to action, availability, enthusiasm
- Tone: professional but not stiff, confident but not arrogant
- Must reference specific details from the job posting (not a template letter)
- Do NOT repeat the resume — complement it with narrative and motivation

## "Why Interested" Answer
- 2-3 sentences
- Draw from evaluation strengths and specific aspects of the job posting
- Be specific to this company and role, not generic

## Output Format
Return a JSON object:
{
  "cover_letter": "string — full cover letter text with paragraph breaks (\\n\\n between paragraphs)",
  "why_interested": "string — answer to 'Why are you interested in this role?'"
}

Return ONLY the JSON object, no additional text or markdown.`;

// ─── Call 2: Haiku — Extraction-Based Application Answers ────────────────────

const HAIKU_SYSTEM_PROMPT = `You are a job application form assistant. Extract and format answers to common application questions based on the candidate's profile data.

## Questions to Answer
Generate answers for ALL of the following questions:

1. **Years of relevant experience** — Calculate from work history dates. Use total professional experience, not just for this specific field.
2. **Work authorization** — Use the work_authorization field from the profile. If not set, answer "Information not provided."
3. **Salary expectations** — Use min_salary and max_salary from profile preferences. Format as a range with the currency. If not set, answer "Open to discussion."
4. **Willing to relocate** — Derive from remote_preference and target_locations. If remote_only, say "Prefer remote work." If they have target_locations, mention willingness to be in those areas.
5. **Technical proficiency** — List the candidate's top 5-8 technical skills with their proficiency levels from the skills data.
6. **When can you start?** — Default to "Available after a standard notice period (typically 2 weeks)" unless otherwise indicated.

## Output Format
Return a JSON object:
{
  "application_answers": [
    {
      "question": "string — the question",
      "answer": "string — the answer",
      "source": "string — brief note on where this data came from (e.g., 'work_experiences dates', 'profile.work_authorization', 'profile.salary preferences')"
    }
  ]
}

Rules:
- Answer every question, even if data is incomplete (note what's missing).
- Be concise and factual — these are form fields, not essays.
- Return ONLY the JSON object, no additional text or markdown.`;

interface MaterialsInput {
  userId: string;
  jobPostingId: string;
  applicationId: string;
}

interface MaterialsResult {
  materials: Materials;
}

async function getJobContext(jobPostingId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("job_postings")
    .select(
      "job_title, company_name, country, location, is_remote, job_type, experience_level, description_raw, required_skills, preferred_skills"
    )
    .eq("id", jobPostingId)
    .single();

  if (error) {
    throw new RetryableError(
      `Failed to fetch job posting for materials: ${error.message}`
    );
  }

  return JSON.stringify(data);
}

async function getEvaluationContext(
  userId: string,
  jobPostingId: string
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("job_evaluations")
    .select("overall_score, reasoning, strengths, gaps, recommendation")
    .eq("profile_id", userId)
    .eq("job_posting_id", jobPostingId)
    .single();

  if (error) {
    throw new RetryableError(
      `Failed to fetch evaluation for materials: ${error.message}`
    );
  }

  return JSON.stringify(data);
}

async function getTailoredResumeContext(
  applicationId: string
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("resume_versions")
    .select("content_json, content_markdown")
    .eq("application_id", applicationId)
    .eq("is_base", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new RetryableError(
      `Failed to fetch tailored resume for materials: ${error.message}`
    );
  }

  return JSON.stringify(data);
}

async function getUserProfileContext(
  userId: string
): Promise<{
  profileContext: string;
  coverLetterEnabled: boolean;
  fullAnswers: boolean;
}> {
  const supabase = getSupabaseAdmin();

  const [profileResult, experiencesResult, skillsResult, subResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name, location, country, remote_preference, target_locations, target_countries, min_salary, max_salary, salary_currency, experience_years, work_authorization, cover_letter_enabled"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("work_experiences")
        .select("job_title, company_name, start_date, end_date, is_current")
        .eq("profile_id", userId)
        .order("start_date", { ascending: false }),
      supabase
        .from("skills")
        .select("name, category, proficiency, years_experience")
        .eq("profile_id", userId),
      supabase
        .from("subscriptions")
        .select("plan")
        .eq("profile_id", userId)
        .maybeSingle(),
    ]);

  if (profileResult.error) {
    throw new RetryableError(
      `Failed to fetch profile for materials: ${profileResult.error.message}`
    );
  }

  if (experiencesResult.error) {
    captureMessage("Failed to fetch work experiences for materials", {
      userId,
      error: experiencesResult.error.message,
    });
  }
  if (skillsResult.error) {
    captureMessage("Failed to fetch skills for materials", {
      userId,
      error: skillsResult.error.message,
    });
  }

  const plan = (subResult.data?.plan as string) ?? "free";
  const isPaid = plan === "pro" || plan === "premium";

  // Cover letter: requires paid plan AND user preference enabled
  const userPrefEnabled =
    (profileResult.data?.cover_letter_enabled as boolean) ?? true;
  const coverLetterEnabled = isPaid && userPrefEnabled;

  // Full application answers: paid plans get all fields, free gets limited (3)
  const fullAnswers = isPaid;

  return {
    profileContext: JSON.stringify({
      profile: profileResult.data,
      work_experiences: experiencesResult.data ?? [],
      skills: skillsResult.data ?? [],
    }),
    coverLetterEnabled,
    fullAnswers,
  };
}

function parseClaudeJson(text: string): unknown {
  let cleanText = text.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleanText);
}

export async function runMaterials(
  input: MaterialsInput
): Promise<MaterialsResult> {
  // Fetch all context in parallel
  const [jobContext, evaluationContext, resumeContext, userContext] =
    await Promise.all([
      getJobContext(input.jobPostingId),
      getEvaluationContext(input.userId, input.jobPostingId),
      getTailoredResumeContext(input.applicationId),
      getUserProfileContext(input.userId),
    ]);

  const { profileContext, coverLetterEnabled, fullAnswers } = userContext;

  // ─── Run both LLM calls in parallel ───────────────────────────────────────

  const [sonnetResult, haikuResult] = await Promise.all([
    // Call 1: Sonnet — Cover letter + Why interested
    callClaude({
      agentType: "materials_sonnet",
      userId: input.userId,
      model: "claude-sonnet-4-6",
      systemPrompt: SONNET_SYSTEM_PROMPT,
      userMessage: `Generate a cover letter and "Why interested" answer for this candidate and job posting.

## Job Posting
${jobContext}

## Evaluation Results
${evaluationContext}

## Tailored Resume
${resumeContext}

${!coverLetterEnabled ? 'NOTE: The user has disabled cover letter generation. Set cover_letter to null and still generate the why_interested answer.' : ''}`,
      maxTokens: 2048,
      temperature: 0.7,
    }),
    // Call 2: Haiku — Extraction answers
    callClaude({
      agentType: "materials_haiku",
      userId: input.userId,
      model: "claude-haiku-4-5",
      systemPrompt: HAIKU_SYSTEM_PROMPT,
      userMessage: `Extract application form answers for this candidate.

## Candidate Profile
${profileContext}`,
      maxTokens: 1024,
      temperature: 0,
    }),
  ]);

  // Parse Sonnet response
  let sonnetParsed: { cover_letter?: string | null; why_interested?: string };
  try {
    sonnetParsed = parseClaudeJson(sonnetResult.text) as typeof sonnetParsed;
  } catch {
    captureMessage("Materials Sonnet returned invalid JSON", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      textPreview: sonnetResult.text.substring(0, 200),
    });
    throw new RetryableError("Materials Sonnet returned invalid JSON");
  }

  // Parse Haiku response
  let haikuParsed: {
    application_answers?: Array<{
      question: string;
      answer: string;
      source: string;
    }>;
  };
  try {
    haikuParsed = parseClaudeJson(haikuResult.text) as typeof haikuParsed;
  } catch {
    captureMessage("Materials Haiku returned invalid JSON", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      textPreview: haikuResult.text.substring(0, 200),
    });
    throw new RetryableError("Materials Haiku returned invalid JSON");
  }

  // Combine outputs and validate
  // Free users get max 3 application answer fields; Pro/Premium get all
  const allAnswers = haikuParsed.application_answers ?? [];
  const limitedAnswers = fullAnswers ? allAnswers : allAnswers.slice(0, 3);

  const combined = {
    cover_letter: coverLetterEnabled
      ? (sonnetParsed.cover_letter ?? null)
      : null,
    why_interested: sonnetParsed.why_interested ?? "",
    application_answers: limitedAnswers,
  };

  const validated = MaterialsSchema.safeParse(combined);
  if (!validated.success) {
    captureMessage("Materials combined output failed Zod validation", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      error: validated.error.message,
    });
    throw new RetryableError(
      `Materials output failed validation: ${validated.error.message}`
    );
  }

  const materials = validated.data;

  // Update application record with cover_letter and application_answers
  const supabase = getSupabaseAdmin();
  const { error: updateError } = await supabase
    .from("applications")
    .update({
      cover_letter: materials.cover_letter ?? null,
      application_answers: [
        {
          question: "Why are you interested in this role?",
          answer: materials.why_interested,
          source: "AI-generated from evaluation and job posting",
        },
        ...materials.application_answers,
      ],
    })
    .eq("id", input.applicationId);

  if (updateError) {
    throw new RetryableError(
      `Failed to update application with materials: ${updateError.message}`
    );
  }

  return { materials };
}
