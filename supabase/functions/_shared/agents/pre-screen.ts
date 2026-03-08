import { callClaude, RetryableError } from "../agent-call.ts";
import { getSupabaseAdmin } from "../supabase.ts";
import { PreScreenSchema } from "../validators/pre-screen.ts";
import { captureMessage } from "../sentry.ts";
import type { PreScreen } from "../validators/pre-screen.ts";

const SYSTEM_PROMPT = `You are a job pre-screening assistant. Your job is to quickly determine whether a job posting is a plausible match for a candidate, based on basic disqualifiers.

Check for these disqualifiers:
1. **Title mismatch** — The job title is fundamentally different from the candidate's target roles (e.g., candidate targets "Software Engineer" but job is "Marketing Manager").
2. **Country/location incompatibility** — The job is in a country or location the candidate has not listed as a target, AND the job is not remote (or the candidate does not prefer remote).
3. **Seniority mismatch** — The job requires a significantly different seniority level than the candidate has (e.g., candidate has 2 years experience but job requires "Director" or "15+ years").
4. **Salary range mismatch** — The job's salary range is significantly below the candidate's minimum expectation (more than 20% below).

Rules:
- Be LENIENT. When in doubt, PASS the job through. False negatives (rejecting good matches) are much worse than false positives (passing mediocre matches).
- Only fail jobs that are OBVIOUSLY mismatched. Borderline cases should pass.
- If the job lacks information (e.g., no salary listed), do NOT treat that as a disqualifier.
- Remote jobs are compatible with any location preference.
- Related roles should pass (e.g., "Full Stack Developer" is compatible with "Software Engineer").

Return a JSON object:
{
  "pass": true/false,
  "reason": "Brief explanation of why the job passed or failed",
  "disqualifiers": ["list of specific disqualifiers that caused failure, empty array if pass=true"]
}

Return ONLY the JSON object, no additional text or markdown.`;

interface PreScreenInput {
  userId: string;
  jobPostingId: string;
}

interface UserPreferences {
  targetRoles: string[];
  targetCountries: string[];
  targetLocations: string[];
  remotePreference: string;
  experienceYears: number | null;
  minSalary: number | null;
  maxSalary: number | null;
  salaryCurrency: string;
}

interface JobSummary {
  jobTitle: string;
  companyName: string;
  country: string | null;
  location: string | null;
  isRemote: boolean;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

async function getUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "target_roles, target_countries, target_locations, remote_preference, experience_years"
    )
    .eq("id", userId)
    .single();

  if (profileError) {
    throw new RetryableError(
      `Failed to fetch profile for pre-screen: ${profileError.message}`
    );
  }

  if (!profile) return null;

  const { data: prefs, error: prefsError } = await supabase
    .from("search_preferences")
    .select("min_salary, max_salary, salary_currency")
    .eq("profile_id", userId)
    .single();

  if (prefsError) {
    captureMessage("Failed to fetch search preferences for pre-screen", {
      userId,
      error: prefsError.message,
    });
  }

  return {
    targetRoles: (profile.target_roles as string[]) ?? [],
    targetCountries: (profile.target_countries as string[]) ?? [],
    targetLocations: (profile.target_locations as string[]) ?? [],
    remotePreference: (profile.remote_preference as string) ?? "flexible",
    experienceYears: (profile.experience_years as number) ?? null,
    minSalary: prefs?.min_salary ?? null,
    maxSalary: prefs?.max_salary ?? null,
    salaryCurrency: (prefs?.salary_currency as string) ?? "USD",
  };
}

async function getJobSummary(
  jobPostingId: string
): Promise<JobSummary | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("job_postings")
    .select(
      "job_title, company_name, country, location, is_remote, experience_level, salary_min, salary_max, salary_currency"
    )
    .eq("id", jobPostingId)
    .single();

  if (error) {
    throw new RetryableError(
      `Failed to fetch job posting for pre-screen: ${error.message}`
    );
  }

  if (!data) return null;

  return {
    jobTitle: data.job_title,
    companyName: data.company_name,
    country: data.country,
    location: data.location,
    isRemote: data.is_remote ?? false,
    experienceLevel: data.experience_level,
    salaryMin: data.salary_min,
    salaryMax: data.salary_max,
    salaryCurrency: data.salary_currency,
  };
}

export async function runPreScreen(
  input: PreScreenInput
): Promise<PreScreen> {
  const [userPrefs, jobSummary] = await Promise.all([
    getUserPreferences(input.userId),
    getJobSummary(input.jobPostingId),
  ]);

  if (!userPrefs) {
    // No profile found — pass through to avoid blocking pipeline
    return { pass: true, reason: "No user profile found, passing through", disqualifiers: [] };
  }

  if (!jobSummary) {
    // Job posting not found — fail gracefully
    return { pass: false, reason: "Job posting not found", disqualifiers: ["missing_posting"] };
  }

  const userMessage = `Candidate profile:
- Target roles: ${userPrefs.targetRoles.length > 0 ? userPrefs.targetRoles.join(", ") : "Not specified"}
- Target countries: ${userPrefs.targetCountries.length > 0 ? userPrefs.targetCountries.join(", ") : "Any"}
- Target locations: ${userPrefs.targetLocations.length > 0 ? userPrefs.targetLocations.join(", ") : "Any"}
- Remote preference: ${userPrefs.remotePreference}
- Years of experience: ${userPrefs.experienceYears ?? "Not specified"}
- Salary expectation: ${userPrefs.minSalary ? `${userPrefs.salaryCurrency} ${userPrefs.minSalary.toLocaleString()}` : "Not specified"}${userPrefs.maxSalary ? ` - ${userPrefs.maxSalary.toLocaleString()}` : ""}

Job posting:
- Title: ${jobSummary.jobTitle}
- Company: ${jobSummary.companyName}
- Country: ${jobSummary.country ?? "Not specified"}
- Location: ${jobSummary.location ?? "Not specified"}
- Remote: ${jobSummary.isRemote ? "Yes" : "No"}
- Experience level: ${jobSummary.experienceLevel ?? "Not specified"}
- Salary: ${jobSummary.salaryMin ? `${jobSummary.salaryCurrency ?? "USD"} ${jobSummary.salaryMin.toLocaleString()}` : "Not specified"}${jobSummary.salaryMax ? ` - ${jobSummary.salaryMax.toLocaleString()}` : ""}

Should this job pass the pre-screen?`;

  const result = await callClaude({
    agentType: "pre_screen",
    userId: input.userId,
    model: "claude-haiku-4-5",
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 256,
    temperature: 0,
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
    captureMessage("Pre-screen returned invalid JSON", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      textPreview: cleanText.substring(0, 200),
    });
    throw new RetryableError("Pre-screen returned invalid JSON");
  }

  const validated = PreScreenSchema.safeParse(parsed);
  if (!validated.success) {
    captureMessage("Pre-screen failed Zod validation", {
      userId: input.userId,
      jobPostingId: input.jobPostingId,
      error: validated.error.message,
    });
    throw new RetryableError(
      `Pre-screen output failed validation: ${validated.error.message}`
    );
  }

  return validated.data;
}
