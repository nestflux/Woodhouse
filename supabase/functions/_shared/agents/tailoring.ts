import { callClaude, RetryableError } from "../agent-call.ts";
import { getSupabaseAdmin } from "../supabase.ts";
import { TailoredResumeSchema } from "../validators/tailored-resume.ts";
import { captureMessage } from "../sentry.ts";
import type { TailoredResume } from "../validators/tailored-resume.ts";

const SYSTEM_PROMPT = `You are a resume tailoring agent. Your job is to create a customized resume from a candidate's knowledge base, optimized for a specific job posting.

## CRITICAL CONSTRAINT — Truthfulness
You may ONLY use information present in the user's profile. Do not invent, fabricate, or embellish any experience, company, achievement, metric, or skill. You may rephrase, reorder, and emphasize — but every fact must trace back to a specific entry in the knowledge base.

## Permitted Operations
- Reorder work experience entries to lead with the most relevant
- Reorder achievement bullets within an experience entry
- Rephrase bullets to incorporate keywords from the job description
- Select which skills to highlight in a skills section
- Select which projects to include
- Adjust the professional summary to speak to this specific role
- Emphasize metrics and achievements that align with the posting

## Forbidden Operations
- Adding experience at a company not in the knowledge base
- Inventing metrics or achievements
- Claiming skills the user hasn't listed
- Inflating job titles or proficiency levels
- Adding certifications the user doesn't hold

## Input Context
You will receive:
1. The full job posting (title, company, requirements, description)
2. The evaluation results (strengths, gaps, reasoning, scores)
3. The user's complete knowledge base (profile, work experiences with achievements, skills, education, projects, certifications)

## Output Format
Return a JSON object with this structure:
{
  "resume_content": {
    "header": {
      "full_name": "string",
      "headline": "string — tailored to this role",
      "email": "string",
      "phone": "string (optional)",
      "location": "string (optional)",
      "linkedin_url": "string (optional)",
      "portfolio_url": "string (optional)"
    },
    "summary": "string — 2-3 sentence professional summary tailored to this specific role, highlighting the most relevant experience and skills",
    "work_experience": [
      {
        "source_id": "uuid — the ID from the knowledge base work_experiences entry",
        "company_name": "string — must match knowledge base exactly",
        "job_title": "string — must match knowledge base exactly",
        "location": "string",
        "start_date": "string — ISO date",
        "end_date": "string — ISO date or 'Present'",
        "achievements": [
          {
            "source_id": "uuid — the ID from the knowledge base achievements entry",
            "text": "string — the achievement bullet, potentially rephrased to highlight relevance to this job"
          }
        ]
      }
    ],
    "skills": ["string — selected and ordered by relevance to this job"],
    "education": [
      {
        "source_id": "uuid — the ID from the knowledge base education entry",
        "institution": "string",
        "degree": "string",
        "field_of_study": "string",
        "dates": "string — e.g., '2018 - 2022'"
      }
    ],
    "projects": [
      {
        "source_id": "uuid — the ID from the knowledge base projects entry",
        "name": "string",
        "description": "string — potentially rephrased for relevance",
        "technologies": ["string"]
      }
    ],
    "certifications": [
      {
        "source_id": "uuid — the ID from the knowledge base certifications entry",
        "name": "string",
        "issuer": "string"
      }
    ]
  },
  "tailoring_notes": "string — 2-3 paragraphs explaining what was changed and why: which experiences were prioritized, which keywords were incorporated, what was reordered or emphasized",
  "content_markdown": "string — the complete resume rendered in clean markdown format"
}

## Rules
- Every item in the output MUST include a valid source_id from the knowledge base.
- Include the most relevant 2-4 work experience entries (don't include all if there are many).
- For each work experience, select and order the 3-5 most relevant achievement bullets.
- Skills section should lead with skills mentioned in the job posting.
- Include projects only if they are relevant to the role.
- Include certifications only if they are relevant to the role.
- The content_markdown should be a clean, professional resume that could be rendered as-is.
- Return ONLY the JSON object, no additional text or markdown fencing.`;

interface TailoringInput {
  userId: string;
  jobPostingId: string;
  applicationId: string;
}

interface TailoringResult {
  tailoredResume: TailoredResume;
  resumeVersionId: string;
}

interface KnowledgeBase {
  profile: Record<string, unknown>;
  workExperiences: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  certifications: Array<Record<string, unknown>>;
  validSourceIds: Set<string>;
}

async function buildKnowledgeBase(userId: string): Promise<KnowledgeBase> {
  const supabase = getSupabaseAdmin();

  const [profileResult, experiencesResult, skillsResult, educationResult, projectsResult, certificationsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, phone, headline, summary, location, country, linkedin_url, portfolio_url")
        .eq("id", userId)
        .single(),
      supabase
        .from("work_experiences")
        .select("id, company_name, job_title, location, country, start_date, end_date, is_current, description, achievements(id, description, metrics, skills)")
        .eq("profile_id", userId)
        .order("start_date", { ascending: false }),
      supabase
        .from("skills")
        .select("id, name, category, proficiency, years_experience")
        .eq("profile_id", userId),
      supabase
        .from("education")
        .select("id, institution, degree, field_of_study, start_date, end_date, gpa")
        .eq("profile_id", userId)
        .order("end_date", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name, description, url, technologies")
        .eq("profile_id", userId),
      supabase
        .from("certifications")
        .select("id, name, issuing_organization, issue_date, expiry_date")
        .eq("profile_id", userId),
    ]);

  if (profileResult.error) {
    throw new RetryableError(
      `Failed to fetch profile for tailoring: ${profileResult.error.message}`
    );
  }

  // Log non-critical fetch errors
  if (experiencesResult.error) {
    captureMessage("Failed to fetch work experiences for tailoring", {
      userId, error: experiencesResult.error.message,
    });
  }
  if (skillsResult.error) {
    captureMessage("Failed to fetch skills for tailoring", {
      userId, error: skillsResult.error.message,
    });
  }
  if (educationResult.error) {
    captureMessage("Failed to fetch education for tailoring", {
      userId, error: educationResult.error.message,
    });
  }
  if (projectsResult.error) {
    captureMessage("Failed to fetch projects for tailoring", {
      userId, error: projectsResult.error.message,
    });
  }
  if (certificationsResult.error) {
    captureMessage("Failed to fetch certifications for tailoring", {
      userId, error: certificationsResult.error.message,
    });
  }

  const workExperiences = experiencesResult.data ?? [];
  const education = educationResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const certifications = certificationsResult.data ?? [];

  // Build set of all valid source IDs
  const validSourceIds = new Set<string>();

  for (const exp of workExperiences) {
    validSourceIds.add(exp.id as string);
    const achievements = (exp as Record<string, unknown>).achievements as Array<{ id: string }> | undefined;
    if (achievements) {
      for (const ach of achievements) {
        validSourceIds.add(ach.id);
      }
    }
  }
  for (const edu of education) {
    validSourceIds.add((edu as Record<string, unknown>).id as string);
  }
  for (const proj of projects) {
    validSourceIds.add((proj as Record<string, unknown>).id as string);
  }
  for (const cert of certifications) {
    validSourceIds.add((cert as Record<string, unknown>).id as string);
  }

  return {
    profile: profileResult.data,
    workExperiences,
    skills: skillsResult.data ?? [],
    education,
    projects,
    certifications,
    validSourceIds,
  };
}

async function getJobAndEvaluation(
  userId: string,
  jobPostingId: string
): Promise<{ jobContext: string; evaluationContext: string }> {
  const supabase = getSupabaseAdmin();

  const [jobResult, evalResult] = await Promise.all([
    supabase
      .from("job_postings")
      .select(
        "job_title, company_name, country, location, is_remote, job_type, experience_level, description_raw, required_skills, preferred_skills, responsibilities"
      )
      .eq("id", jobPostingId)
      .single(),
    supabase
      .from("job_evaluations")
      .select("overall_score, skill_score, experience_score, seniority_score, location_score, technology_score, reasoning, strengths, gaps, recommendation")
      .eq("profile_id", userId)
      .eq("job_posting_id", jobPostingId)
      .single(),
  ]);

  if (jobResult.error) {
    throw new RetryableError(
      `Failed to fetch job posting for tailoring: ${jobResult.error.message}`
    );
  }
  if (evalResult.error) {
    throw new RetryableError(
      `Failed to fetch evaluation for tailoring: ${evalResult.error.message}`
    );
  }

  return {
    jobContext: JSON.stringify(jobResult.data),
    evaluationContext: JSON.stringify(evalResult.data),
  };
}

function validateSourceIds(
  resume: TailoredResume,
  validSourceIds: Set<string>
): string[] {
  const invalidIds: string[] = [];

  // Check work experience source_ids
  for (const exp of resume.resume_content.work_experience) {
    if (!validSourceIds.has(exp.source_id)) {
      invalidIds.push(`work_experience: ${exp.source_id}`);
    }
    for (const ach of exp.achievements) {
      if (!validSourceIds.has(ach.source_id)) {
        invalidIds.push(`achievement: ${ach.source_id}`);
      }
    }
  }

  // Check education source_ids
  for (const edu of resume.resume_content.education) {
    if (!validSourceIds.has(edu.source_id)) {
      invalidIds.push(`education: ${edu.source_id}`);
    }
  }

  // Check project source_ids
  if (resume.resume_content.projects) {
    for (const proj of resume.resume_content.projects) {
      if (!validSourceIds.has(proj.source_id)) {
        invalidIds.push(`project: ${proj.source_id}`);
      }
    }
  }

  // Check certification source_ids
  if (resume.resume_content.certifications) {
    for (const cert of resume.resume_content.certifications) {
      if (!validSourceIds.has(cert.source_id)) {
        invalidIds.push(`certification: ${cert.source_id}`);
      }
    }
  }

  return invalidIds;
}

async function buildSystemPrompt(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  // Fetch tailoring prompt config
  const { data: configRows } = await supabase
    .from("system_config")
    .select("key, value")
    .in("key", ["tailoring_prompt_mode", "tailoring_prompt_admin_text"]);

  const config = Object.fromEntries(
    (configRows ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value])
  );

  const mode = config["tailoring_prompt_mode"] ?? "system_default";
  const adminText = config["tailoring_prompt_admin_text"] ?? null;

  let prompt = SYSTEM_PROMPT;

  if (mode === "admin_custom" && adminText) {
    prompt += `\n\n## Additional Tailoring Instructions (Admin)\n${adminText}`;
  } else if (mode === "user_choice") {
    if (adminText) {
      prompt += `\n\n## Admin Base Instructions\n${adminText}`;
    }

    // Fetch user's tailoring instructions
    const { data: prefs } = await supabase
      .from("search_preferences")
      .select("tailoring_instructions")
      .eq("profile_id", userId)
      .maybeSingle();

    const userInstructions = prefs?.tailoring_instructions;
    if (userInstructions) {
      prompt += `\n\n## User Tailoring Preferences\nThe user has requested the following tailoring approach. Follow these preferences while maintaining all truthfulness and safety constraints above.\n\n${userInstructions}`;
    }
  }

  return prompt;
}

export async function runTailoring(
  input: TailoringInput
): Promise<TailoringResult> {
  // Build knowledge base, job context, and system prompt in parallel
  const [knowledgeBase, jobAndEval, systemPrompt] = await Promise.all([
    buildKnowledgeBase(input.userId),
    getJobAndEvaluation(input.userId, input.jobPostingId),
    buildSystemPrompt(input.userId),
  ]);

  const { jobContext, evaluationContext } = jobAndEval;

  const knowledgeBaseContext = JSON.stringify({
    profile: knowledgeBase.profile,
    work_experiences: knowledgeBase.workExperiences,
    skills: knowledgeBase.skills,
    education: knowledgeBase.education,
    projects: knowledgeBase.projects,
    certifications: knowledgeBase.certifications,
  });

  const result = await callClaude({
    agentType: "tailoring",
    userId: input.userId,
    model: "claude-sonnet-4-6",
    systemPrompt,
    cacheableContext: knowledgeBaseContext,
    userMessage: `Tailor this candidate's resume for the following job posting.

## Job Posting
${jobContext}

## Evaluation Results
${evaluationContext}

Generate a tailored resume that maximizes this candidate's presentation for this specific role.`,
    maxTokens: 4096,
    temperature: 0.4,
  });

  // Parse and validate the output
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
    captureMessage("Tailoring returned invalid JSON", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      textPreview: cleanText.substring(0, 200),
    });
    throw new RetryableError("Tailoring returned invalid JSON");
  }

  const validated = TailoredResumeSchema.safeParse(parsed);
  if (!validated.success) {
    captureMessage("Tailoring failed Zod validation", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      error: validated.error.message,
    });
    throw new RetryableError(
      `Tailoring output failed validation: ${validated.error.message}`
    );
  }

  const tailoredResume = validated.data;

  // Verify all source_ids reference real knowledge base entries
  const invalidIds = validateSourceIds(tailoredResume, knowledgeBase.validSourceIds);
  if (invalidIds.length > 0) {
    captureMessage("Tailoring contains invalid source_ids", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      invalidIds,
    });
    throw new RetryableError(
      `Tailoring output contains invalid source_ids: ${invalidIds.join(", ")}`
    );
  }

  // Save to resume_versions
  const supabase = getSupabaseAdmin();

  const { data: resumeVersion, error: saveError } = await supabase
    .from("resume_versions")
    .insert({
      profile_id: input.userId,
      application_id: input.applicationId,
      job_posting_id: input.jobPostingId,
      content_json: tailoredResume.resume_content,
      content_markdown: tailoredResume.content_markdown,
      tailoring_notes: tailoredResume.tailoring_notes,
      is_base: false,
    })
    .select("id")
    .single();

  if (saveError || !resumeVersion) {
    throw new RetryableError(
      `Failed to save resume version: ${saveError?.message ?? "No record returned"}`
    );
  }

  return {
    tailoredResume,
    resumeVersionId: resumeVersion.id,
  };
}
