import { callClaude, RetryableError } from "../agent-call.ts";
import { getSupabaseAdmin } from "../supabase.ts";
import { EvaluationSchema } from "../validators/evaluation.ts";
import { captureMessage } from "../sentry.ts";
import type { Evaluation } from "../validators/evaluation.ts";

const SYSTEM_PROMPT = `You are a job evaluation agent. Score how well a candidate matches a job posting across five dimensions.

## Scoring Rubric

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Skill alignment | 30% | Percentage of required/preferred skills the candidate possesses, weighted by proficiency level |
| Experience match | 25% | Years of experience vs. requirement, depth of relevant experience in similar roles |
| Seniority fit | 15% | Role level (junior/mid/senior/lead/director) vs. candidate's career level |
| Location compatibility | 15% | Location match with candidate's preferences, including remote compatibility |
| Technology overlap | 15% | Specific tech stack match between the job's requirements and candidate's known technologies |

## Scoring Guidelines

For each dimension, score 0-100:
- 90-100: Excellent match, candidate exceeds requirements
- 70-89: Good match, candidate meets most requirements
- 50-69: Partial match, candidate has some relevant experience but gaps exist
- 30-49: Weak match, significant gaps in this dimension
- 0-29: Poor match, major misalignment

## Overall Score Calculation
Calculate the weighted overall score: skill×0.30 + experience×0.25 + seniority×0.15 + location×0.15 + technology×0.15

## Recommendation Labels
Based on the overall score:
- 80+: "strong_match"
- 65-79: "good_match"
- 50-64: "possible_match"
- 35-49: "weak_match"
- Below 35: "no_match"

## Output Format
Return a JSON object:
{
  "overall_score": number (0-100, weighted composite),
  "skill_score": number (0-100),
  "experience_score": number (0-100),
  "seniority_score": number (0-100),
  "location_score": number (0-100),
  "technology_score": number (0-100),
  "recommendation": "strong_match" | "good_match" | "possible_match" | "weak_match" | "no_match",
  "reasoning": "2-3 paragraph explanation of the overall assessment",
  "strengths": ["5-7 specific strengths the candidate brings to this role"],
  "gaps": ["3-5 specific areas where the candidate may fall short"]
}

Rules:
- Be objective and specific — reference actual skills, roles, and experience from the profile.
- If the job description lacks detail in a dimension, give the benefit of the doubt (score 50-60 for that dimension).
- For location: remote jobs score 100 for any candidate. If candidate prefers remote and job is remote, score 100.
- For seniority: "entry" with 0-2 years experience is fine, "senior" with 5+ years, etc. Slight mismatches (1 level) should score 60-70.
- Ensure the overall_score matches the weighted calculation of individual scores.
- Return ONLY the JSON object, no additional text or markdown.`;

interface EvaluationInput {
  userId: string;
  jobPostingId: string;
}

interface EvaluationResult {
  evaluation: Evaluation;
  passesThreshold: boolean;
  evaluationId: string;
  applicationId?: string;
}

interface UserContext {
  profileContext: string;
  matchThreshold: number;
}

async function buildUserProfileContext(userId: string): Promise<UserContext> {
  const supabase = getSupabaseAdmin();

  const [profileResult, experiencesResult, skillsResult, educationResult, projectsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name, headline, summary, target_roles, target_countries, target_locations, remote_preference, experience_years, match_threshold, country, location"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("work_experiences")
        .select(
          "job_title, company_name, start_date, end_date, is_current, description, country, location, achievements(description)"
        )
        .eq("profile_id", userId)
        .order("start_date", { ascending: false }),
      supabase
        .from("skills")
        .select("name, category, proficiency, years_experience")
        .eq("profile_id", userId),
      supabase
        .from("education")
        .select("institution, degree, field_of_study, start_date, end_date, gpa")
        .eq("profile_id", userId)
        .order("end_date", { ascending: false }),
      supabase
        .from("projects")
        .select("name, description, url, technologies")
        .eq("profile_id", userId),
    ]);

  if (profileResult.error) {
    throw new RetryableError(
      `Failed to fetch profile for evaluation: ${profileResult.error.message}`
    );
  }

  // Log non-critical fetch errors for observability
  if (experiencesResult.error) {
    captureMessage("Failed to fetch work experiences for evaluation", {
      userId, error: experiencesResult.error.message,
    });
  }
  if (skillsResult.error) {
    captureMessage("Failed to fetch skills for evaluation", {
      userId, error: skillsResult.error.message,
    });
  }
  if (educationResult.error) {
    captureMessage("Failed to fetch education for evaluation", {
      userId, error: educationResult.error.message,
    });
  }
  if (projectsResult.error) {
    captureMessage("Failed to fetch projects for evaluation", {
      userId, error: projectsResult.error.message,
    });
  }

  const matchThreshold =
    (profileResult.data?.match_threshold as number) ?? 70;

  return {
    profileContext: JSON.stringify({
      profile: profileResult.data,
      work_experiences: experiencesResult.data ?? [],
      skills: skillsResult.data ?? [],
      education: educationResult.data ?? [],
      projects: projectsResult.data ?? [],
    }),
    matchThreshold,
  };
}

async function getJobPostingContext(jobPostingId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("job_postings")
    .select(
      "job_title, company_name, country, location, is_remote, job_type, experience_level, salary_min, salary_max, salary_currency, description_raw, required_skills, preferred_skills, responsibilities, benefits"
    )
    .eq("id", jobPostingId)
    .single();

  if (error) {
    throw new RetryableError(
      `Failed to fetch job posting for evaluation: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(`Job posting ${jobPostingId} not found`);
  }

  return JSON.stringify(data);
}

export async function runEvaluation(
  input: EvaluationInput
): Promise<EvaluationResult> {
  // Build profile context (cached across evaluations in the same run)
  const [userContext, jobContext] = await Promise.all([
    buildUserProfileContext(input.userId),
    getJobPostingContext(input.jobPostingId),
  ]);

  const { profileContext, matchThreshold } = userContext;

  const result = await callClaude({
    agentType: "evaluation",
    userId: input.userId,
    model: "claude-sonnet-4-6",
    systemPrompt: SYSTEM_PROMPT,
    cacheableContext: profileContext,
    userMessage: `Evaluate how well this candidate matches the following job posting:\n\n${jobContext}`,
    maxTokens: 2048,
    temperature: 0.3,
  });

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
    captureMessage("Evaluation returned invalid JSON", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      textPreview: cleanText.substring(0, 200),
    });
    throw new RetryableError("Evaluation returned invalid JSON");
  }

  const validated = EvaluationSchema.safeParse(parsed);
  if (!validated.success) {
    captureMessage("Evaluation failed Zod validation", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      error: validated.error.message,
    });
    throw new RetryableError(
      `Evaluation output failed validation: ${validated.error.message}`
    );
  }

  const evaluation = validated.data;
  const passesThreshold = evaluation.overall_score >= matchThreshold;

  // Save evaluation to job_evaluations
  const supabase = getSupabaseAdmin();

  const { data: evalRecord, error: evalError } = await supabase
    .from("job_evaluations")
    .upsert(
      {
        profile_id: input.userId,
        job_posting_id: input.jobPostingId,
        overall_score: evaluation.overall_score,
        skill_score: evaluation.skill_score,
        experience_score: evaluation.experience_score,
        seniority_score: evaluation.seniority_score,
        location_score: evaluation.location_score,
        technology_score: evaluation.technology_score,
        reasoning: evaluation.reasoning,
        strengths: evaluation.strengths,
        gaps: evaluation.gaps,
        recommendation: evaluation.recommendation,
        passes_threshold: passesThreshold,
        evaluated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,job_posting_id" }
    )
    .select("id")
    .single();

  if (evalError || !evalRecord) {
    throw new RetryableError(
      `Failed to save evaluation: ${evalError?.message ?? "No record returned"}`
    );
  }

  const evaluationId = evalRecord.id;
  let applicationId: string | undefined;

  // If passes threshold, create application with status='draft'
  if (passesThreshold) {
    const { data: appRecord, error: appError } = await supabase
      .from("applications")
      .upsert(
        {
          profile_id: input.userId,
          job_posting_id: input.jobPostingId,
          job_evaluation_id: evaluationId,
          status: "draft",
        },
        { onConflict: "profile_id,job_posting_id" }
      )
      .select("id")
      .single();

    if (appError) {
      throw new RetryableError(
        `Failed to create application: ${appError.message}`
      );
    }

    applicationId = appRecord?.id;
  }

  return {
    evaluation,
    passesThreshold,
    evaluationId,
    applicationId,
  };
}
