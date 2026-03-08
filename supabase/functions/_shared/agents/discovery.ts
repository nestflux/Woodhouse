import { z } from "npm:zod@3";
import { callClaude } from "../agent-call.ts";
import { getSupabaseAdmin } from "../supabase.ts";
import { DiscoveryPostingSchema } from "../validators/discovery.ts";
import { captureException, captureMessage } from "../sentry.ts";
import type { DiscoveryPosting } from "../validators/discovery.ts";

/**
 * Schema for AI-extracted fields from a job description.
 * Only the supplementary fields the AI extracts, not the core fields
 * (company_name, job_title, etc.) which are already known from the API source.
 */
const JobExtractionSchema = z.object({
  required_skills: z.array(z.string()).optional(),
  preferred_skills: z.array(z.string()).optional(),
  experience_level: z
    .enum(["entry", "mid", "senior", "lead", "director", "executive"])
    .optional()
    .nullable(),
  salary_min: z.number().optional().nullable(),
  salary_max: z.number().optional().nullable(),
  salary_currency: z.string().optional().nullable(),
  is_remote: z.boolean().optional(),
  job_type: z
    .enum(["full_time", "part_time", "contract", "freelance", "internship"])
    .optional()
    .nullable(),
  responsibilities: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
});

const SERPAPI_BASE_URL = "https://serpapi.com/search";
const JSEARCH_BASE_URL = "https://jsearch.p.rapidapi.com/search";
const API_FETCH_TIMEOUT_MS = 30_000;
const AI_PARSE_CONCURRENCY = 5;
const DEDUP_CHUNK_SIZE = 50;
const MAX_DISCOVERY_API_CALLS = 30;
const MIN_DESCRIPTION_LENGTH = 20;

const JOB_PARSING_SYSTEM_PROMPT = `You are a job posting parser. Extract structured data from the job description text provided.

Return a JSON object with the following fields (include only what you can extract):

{
  "required_skills": ["string — skills explicitly required"],
  "preferred_skills": ["string — skills listed as nice-to-have or preferred"],
  "experience_level": "entry" | "mid" | "senior" | "lead" | "director" | "executive",
  "salary_min": number or null,
  "salary_max": number or null,
  "salary_currency": "string — e.g. USD, EUR, GBP" or null,
  "is_remote": true/false,
  "job_type": "full_time" | "part_time" | "contract" | "freelance" | "internship",
  "responsibilities": ["string — key responsibilities"],
  "benefits": ["string — listed benefits"]
}

Rules:
- For experience_level, infer from titles (e.g. "Senior" → senior, "Lead" → lead, "Junior" → entry) and years of experience mentioned.
- Extract individual skills as separate items, not grouped phrases.
- If salary is mentioned as a range like "$120K-$150K", parse to salary_min: 120000, salary_max: 150000.
- If salary is mentioned as a single value like "$120K/yr", set both min and max to 120000.
- Return ONLY the JSON object, no additional text or markdown.`;

const DEFAULT_PARSED_FIELDS: ParsedJobFields = {
  required_skills: [],
  preferred_skills: [],
  experience_level: null,
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  is_remote: false,
  job_type: null,
  responsibilities: [],
  benefits: [],
};

// ─── Utilities ──────────────────────────────────────────────────────────────

function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    API_FETCH_TIMEOUT_MS
  );
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
}

/**
 * Run promises with bounded concurrency.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => runNext()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Split an array into chunks of a given size.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Normalize a string for fuzzy comparison: handle diacritics, lowercase, strip punctuation.
 */
function normalizeForComparison(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── SerpAPI Google Jobs ────────────────────────────────────────────────────

interface GoogleJobsParams {
  query: string;
  location?: string;
  country?: string;
  radius?: number;
}

interface SerpApiJob {
  job_id: string;
  title: string;
  company_name: string;
  location: string;
  via?: string;
  description: string;
  thumbnail?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    work_from_home?: boolean;
    salary?: string;
  };
  job_highlights?: Array<{
    title: string;
    items: string[];
  }>;
  apply_options?: Array<{
    title: string;
    link: string;
  }>;
}

function normalizeScheduleType(
  scheduleType?: string
): DiscoveryPosting["job_type"] {
  if (!scheduleType) return null;
  const lower = scheduleType.toLowerCase();
  if (lower.includes("full")) return "full_time";
  if (lower.includes("part")) return "part_time";
  if (lower.includes("contract") || lower.includes("contractor"))
    return "contract";
  if (lower.includes("intern")) return "internship";
  if (lower.includes("freelance")) return "freelance";
  return null;
}

export async function searchGoogleJobs(
  params: GoogleJobsParams
): Promise<DiscoveryPosting[]> {
  const apiKey = Deno.env.get("SERPAPI_API_KEY");
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not set");
  }

  const url = new URL(SERPAPI_BASE_URL);
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", params.query);
  url.searchParams.set("api_key", apiKey);
  if (params.location) url.searchParams.set("location", params.location);
  if (params.country) url.searchParams.set("gl", params.country);
  if (params.radius) url.searchParams.set("lrad", String(params.radius));

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    throw new Error(
      `SerpAPI request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const jobs: SerpApiJob[] = data.jobs_results ?? [];

  const postings: DiscoveryPosting[] = [];

  for (const job of jobs) {
    try {
      const applyLink = job.apply_options?.[0]?.link;

      const posting: DiscoveryPosting = {
        external_id: job.job_id,
        source: "google_jobs",
        source_url:
          applyLink ??
          `https://www.google.com/search?q=${encodeURIComponent(`${job.title} ${job.company_name} jobs`)}`,
        company_name: job.company_name,
        job_title: job.title,
        location: job.location || null,
        country: params.country?.toUpperCase() || null,
        is_remote: job.detected_extensions?.work_from_home ?? false,
        job_type: normalizeScheduleType(
          job.detected_extensions?.schedule_type
        ),
        experience_level: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        description_raw: job.description,
        required_skills: [],
        preferred_skills: [],
        responsibilities: [],
        benefits: [],
        application_url: applyLink || null,
        posted_date: null,
      };

      const validated = DiscoveryPostingSchema.safeParse(posting);
      if (validated.success) {
        postings.push(validated.data);
      } else {
        captureMessage("Google Jobs posting failed validation", {
          job_id: job.job_id,
          error: validated.error.message,
        });
      }
    } catch (err) {
      captureException(err, {
        source: "google_jobs",
        job_id: job.job_id,
      });
    }
  }

  return postings;
}

// ─── JSearch API ────────────────────────────────────────────────────────────

interface JSearchParams {
  query: string;
  location?: string;
  country?: string;
  jobType?: string;
}

interface JSearchJob {
  job_id: string;
  employer_name: string;
  employer_logo?: string;
  job_title: string;
  job_description: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_apply_link?: string;
  job_is_remote?: boolean;
  job_employment_type?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
}

function normalizeJSearchEmploymentType(
  type?: string
): DiscoveryPosting["job_type"] {
  if (!type) return null;
  const upper = type.toUpperCase();
  if (upper === "FULLTIME") return "full_time";
  if (upper === "PARTTIME") return "part_time";
  if (upper === "CONTRACTOR" || upper === "CONTRACT") return "contract";
  if (upper === "INTERN") return "internship";
  return null;
}

function annualizeSalary(
  amount: number | null | undefined,
  period?: string | null
): number | null {
  if (amount == null) return null;
  if (!period) return amount;
  const p = period.toUpperCase();
  if (p === "HOUR") return Math.round(amount * 2080);
  if (p === "DAY") return Math.round(amount * 260);
  if (p === "WEEK") return Math.round(amount * 52);
  if (p === "MONTH") return Math.round(amount * 12);
  return amount;
}

export async function searchJSearch(
  params: JSearchParams
): Promise<DiscoveryPosting[]> {
  const apiKey = Deno.env.get("JSEARCH_API_KEY");
  if (!apiKey) {
    throw new Error("JSEARCH_API_KEY is not set");
  }

  let queryStr = params.query;
  if (params.location) queryStr += ` in ${params.location}`;

  const url = new URL(JSEARCH_BASE_URL);
  url.searchParams.set("query", queryStr);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  if (params.country) url.searchParams.set("country", params.country);
  if (params.jobType)
    url.searchParams.set("employment_types", params.jobType);

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  if (!response.ok) {
    throw new Error(
      `JSearch API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const jobs: JSearchJob[] = data.data ?? [];

  const postings: DiscoveryPosting[] = [];

  for (const job of jobs) {
    try {
      const location = [job.job_city, job.job_state]
        .filter(Boolean)
        .join(", ");

      const posting: DiscoveryPosting = {
        external_id: job.job_id,
        source: "jsearch",
        source_url:
          job.job_apply_link ??
          `https://www.google.com/search?q=${encodeURIComponent(`${job.job_title} ${job.employer_name} jobs`)}`,
        company_name: job.employer_name,
        job_title: job.job_title,
        location: location || null,
        country: job.job_country || params.country?.toUpperCase() || null,
        is_remote: job.job_is_remote ?? false,
        job_type: normalizeJSearchEmploymentType(job.job_employment_type),
        experience_level: null,
        salary_min: annualizeSalary(
          job.job_min_salary,
          job.job_salary_period
        ),
        salary_max: annualizeSalary(
          job.job_max_salary,
          job.job_salary_period
        ),
        salary_currency: job.job_salary_currency || null,
        description_raw: job.job_description,
        required_skills: [],
        preferred_skills: [],
        responsibilities: [],
        benefits: [],
        application_url: job.job_apply_link || null,
        posted_date: job.job_posted_at_datetime_utc || null,
      };

      const validated = DiscoveryPostingSchema.safeParse(posting);
      if (validated.success) {
        postings.push(validated.data);
      } else {
        captureMessage("JSearch posting failed validation", {
          job_id: job.job_id,
          error: validated.error.message,
        });
      }
    } catch (err) {
      captureException(err, {
        source: "jsearch",
        job_id: job.job_id,
      });
    }
  }

  return postings;
}

// ─── Greenhouse Board Scraping ───────────────────────────────────────────────

interface GreenhouseDepartment {
  id: number;
  name: string;
  jobs: GreenhouseJob[];
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: {
    name: string;
  };
  metadata?: Array<{
    name: string;
    value: string | string[] | null;
  }>;
  updated_at: string;
  content?: string;
}

/**
 * Fetch and parse a Greenhouse job board, returning normalized postings.
 * Greenhouse public boards at boards.greenhouse.io/{slug} serve JSON when
 * the /departments path is requested. This is the documented public API endpoint.
 */
export async function scrapeGreenhouseBoard(
  boardUrl: string,
  companyName: string
): Promise<DiscoveryPosting[]> {
  const cleanUrl = boardUrl.replace(/\/+$/, "");
  const departmentsUrl = `${cleanUrl}/departments`;

  const response = await fetchWithTimeout(departmentsUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Greenhouse board fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const departments: GreenhouseDepartment[] = data.departments ?? [];

  const postings: DiscoveryPosting[] = [];

  for (const dept of departments) {
    for (const job of dept.jobs ?? []) {
      try {
        const locationName = job.location?.name || null;
        const isRemote =
          locationName?.toLowerCase().includes("remote") ?? false;

        const posting: DiscoveryPosting = {
          external_id: String(job.id),
          source: "greenhouse",
          source_url: job.absolute_url,
          company_name: companyName,
          job_title: job.title,
          location: locationName,
          country: null,
          is_remote: isRemote,
          job_type: null,
          experience_level: null,
          salary_min: null,
          salary_max: null,
          salary_currency: null,
          description_raw: job.content || "",
          required_skills: [],
          preferred_skills: [],
          responsibilities: [],
          benefits: [],
          application_url: job.absolute_url,
          posted_date: job.updated_at || null,
        };

        const validated = DiscoveryPostingSchema.safeParse(posting);
        if (validated.success) {
          postings.push(validated.data);
        } else {
          captureMessage("Greenhouse posting failed validation", {
            job_id: String(job.id),
            board_url: boardUrl,
            error: validated.error.message,
          });
        }
      } catch (err) {
        captureException(err, {
          source: "greenhouse",
          job_id: String(job.id),
          board_url: boardUrl,
        });
      }
    }
  }

  return postings;
}

// ─── Lever Board Scraping ────────────────────────────────────────────────────

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  categories: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  description: string;
  descriptionPlain: string;
  lists?: Array<{
    text: string;
    content: string;
  }>;
  createdAt: number;
}

/**
 * Fetch and parse a Lever job board, returning normalized postings.
 * Lever boards expose JSON at `{boardUrl}?mode=json`.
 */
export async function scrapeLeverBoard(
  boardUrl: string,
  companyName: string
): Promise<DiscoveryPosting[]> {
  const cleanUrl = boardUrl.replace(/\/+$/, "");
  const jsonUrl = `${cleanUrl}?mode=json`;

  const response = await fetchWithTimeout(jsonUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Lever board fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const jobs: LeverJob[] = await response.json();

  const postings: DiscoveryPosting[] = [];

  for (const job of jobs) {
    try {
      const locationName = job.categories?.location || null;
      const isRemote =
        locationName?.toLowerCase().includes("remote") ?? false;
      const commitment = job.categories?.commitment?.toLowerCase() || "";

      let jobType: DiscoveryPosting["job_type"] = null;
      if (commitment.includes("full")) jobType = "full_time";
      else if (commitment.includes("part")) jobType = "part_time";
      else if (commitment.includes("contract")) jobType = "contract";
      else if (commitment.includes("intern")) jobType = "internship";
      else if (commitment.includes("freelance")) jobType = "freelance";

      const descriptionText =
        job.descriptionPlain || job.description || "";

      const posting: DiscoveryPosting = {
        external_id: job.id,
        source: "lever",
        source_url: job.hostedUrl,
        company_name: companyName,
        job_title: job.text,
        location: locationName,
        country: null,
        is_remote: isRemote,
        job_type: jobType,
        experience_level: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        description_raw: descriptionText,
        required_skills: [],
        preferred_skills: [],
        responsibilities: [],
        benefits: [],
        application_url: job.applyUrl || job.hostedUrl,
        posted_date: job.createdAt
          ? new Date(job.createdAt).toISOString()
          : null,
      };

      const validated = DiscoveryPostingSchema.safeParse(posting);
      if (validated.success) {
        postings.push(validated.data);
      } else {
        captureMessage("Lever posting failed validation", {
          job_id: job.id,
          board_url: boardUrl,
          error: validated.error.message,
        });
      }
    } catch (err) {
      captureException(err, {
        source: "lever",
        job_id: job.id,
        board_url: boardUrl,
      });
    }
  }

  return postings;
}

// ─── Tracked Boards Discovery ────────────────────────────────────────────────

interface TrackedBoard {
  id: string;
  profile_id: string;
  platform: "greenhouse" | "lever";
  board_url: string;
  company_name: string;
  is_active: boolean;
  last_checked_at: string | null;
}

/**
 * Filter postings by matching at least one keyword in the job title or description.
 */
function filterByKeywords(
  postings: DiscoveryPosting[],
  keywords: string[]
): DiscoveryPosting[] {
  if (keywords.length === 0) return postings;

  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  return postings.filter((p) => {
    const title = p.job_title.toLowerCase();
    const desc = (p.description_raw || "").toLowerCase();
    return lowerKeywords.some((kw) => title.includes(kw) || desc.includes(kw));
  });
}

/**
 * Check all active tracked boards for a user, filter by search keywords, and return new postings.
 * Updates `last_checked_at` on each board after checking.
 */
export async function checkTrackedBoards(
  userId: string,
  keywords: string[]
): Promise<{ postings: DiscoveryPosting[]; errors: string[] }> {
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  const allPostings: DiscoveryPosting[] = [];

  const { data: boards } = await supabase
    .from("tracked_boards")
    .select("*")
    .eq("profile_id", userId)
    .eq("is_active", true);

  if (!boards || boards.length === 0) {
    return { postings: [], errors: [] };
  }

  async function updateLastChecked(boardId: string) {
    const { error: updateError } = await supabase
      .from("tracked_boards")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", boardId);

    if (updateError) {
      captureMessage("Failed to update last_checked_at", {
        board_id: boardId,
        error: updateError.message,
      });
    }
  }

  const boardTasks = (boards as TrackedBoard[]).map(
    (board) => async () => {
      try {
        let boardPostings: DiscoveryPosting[];

        if (board.platform === "greenhouse") {
          boardPostings = await scrapeGreenhouseBoard(
            board.board_url,
            board.company_name
          );
        } else {
          boardPostings = await scrapeLeverBoard(
            board.board_url,
            board.company_name
          );
        }

        const filtered = filterByKeywords(boardPostings, keywords);
        allPostings.push(...filtered);
        await updateLastChecked(board.id);
      } catch (err) {
        const msg = `Board check failed for ${board.company_name} (${board.platform}): ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        captureException(err, {
          source: board.platform,
          board_id: board.id,
          board_url: board.board_url,
        });

        // Still update last_checked_at even on failure so we don't retry constantly
        await updateLastChecked(board.id);
      }
    }
  );

  await runWithConcurrency(boardTasks, AI_PARSE_CONCURRENCY);

  return { postings: allPostings, errors };
}

// ─── AI Job Description Parsing ─────────────────────────────────────────────

interface ParsedJobFields {
  required_skills: string[];
  preferred_skills: string[];
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  is_remote: boolean;
  job_type: string | null;
  responsibilities: string[];
  benefits: string[];
}

export async function parseJobDescription(
  description: string,
  userId: string
): Promise<ParsedJobFields> {
  if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
    return { ...DEFAULT_PARSED_FIELDS };
  }

  const truncated = description.slice(0, 8000);

  const result = await callClaude({
    agentType: "job-description-parser",
    userId,
    model: "claude-haiku-4-5",
    systemPrompt: JOB_PARSING_SYSTEM_PROMPT,
    userMessage: `Parse this job description:\n\n${truncated}`,
    maxTokens: 1024,
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
    captureMessage("Job description parsing returned invalid JSON", {
      userId,
      textPreview: cleanText.substring(0, 200),
    });
    return { ...DEFAULT_PARSED_FIELDS };
  }

  const validated = JobExtractionSchema.safeParse(parsed);
  if (!validated.success) {
    captureMessage("Job description parsing failed Zod validation", {
      userId,
      error: validated.error.message,
    });
    return { ...DEFAULT_PARSED_FIELDS };
  }

  return {
    required_skills: validated.data.required_skills ?? [],
    preferred_skills: validated.data.preferred_skills ?? [],
    experience_level: validated.data.experience_level ?? null,
    salary_min: validated.data.salary_min ?? null,
    salary_max: validated.data.salary_max ?? null,
    salary_currency: validated.data.salary_currency ?? null,
    is_remote: validated.data.is_remote ?? false,
    job_type: validated.data.job_type ?? null,
    responsibilities: validated.data.responsibilities ?? [],
    benefits: validated.data.benefits ?? [],
  };
}

// ─── Deduplication ──────────────────────────────────────────────────────────

interface DeduplicationResult {
  newPostings: DiscoveryPosting[];
  duplicateCount: number;
}

export async function deduplicatePostings(
  postings: DiscoveryPosting[]
): Promise<DeduplicationResult> {
  if (postings.length === 0) return { newPostings: [], duplicateCount: 0 };

  const supabase = getSupabaseAdmin();
  let duplicateCount = 0;
  const newPostings: DiscoveryPosting[] = [];

  // Batch-check for same-source duplicates (chunked to avoid query size limits)
  const externalIds = postings.map((p) => p.external_id);
  const sources = [...new Set(postings.map((p) => p.source))];

  const existingSourceKeys = new Set<string>();
  for (const idChunk of chunk(externalIds, DEDUP_CHUNK_SIZE)) {
    const { data } = await supabase
      .from("job_postings")
      .select("external_id, source")
      .in("source", sources)
      .in("external_id", idChunk);

    for (const e of data ?? []) {
      existingSourceKeys.add(`${e.source}:${e.external_id}`);
    }
  }

  // Batch-check for cross-source duplicates by company + title (chunked)
  const companyNames = [...new Set(postings.map((p) => p.company_name))];

  const existingCrossKeys = new Set<string>();
  for (const nameChunk of chunk(companyNames, DEDUP_CHUNK_SIZE)) {
    const { data } = await supabase
      .from("job_postings")
      .select("company_name, job_title, location")
      .in("company_name", nameChunk)
      .eq("status", "active");

    for (const e of data ?? []) {
      existingCrossKeys.add(
        `${normalizeForComparison(e.company_name)}|${normalizeForComparison(e.job_title)}|${normalizeForComparison(e.location ?? "")}`
      );
    }
  }

  for (const posting of postings) {
    const sourceKey = `${posting.source}:${posting.external_id}`;
    if (existingSourceKeys.has(sourceKey)) {
      duplicateCount++;
      continue;
    }

    const crossKey = `${normalizeForComparison(posting.company_name)}|${normalizeForComparison(posting.job_title)}|${normalizeForComparison(posting.location ?? "")}`;
    if (existingCrossKeys.has(crossKey)) {
      duplicateCount++;
      continue;
    }

    // Also deduplicate within the current batch
    existingSourceKeys.add(sourceKey);
    existingCrossKeys.add(crossKey);

    newPostings.push(posting);
  }

  return { newPostings, duplicateCount };
}

// ─── Save Postings ──────────────────────────────────────────────────────────

export async function savePostings(
  postings: DiscoveryPosting[],
  userId: string
): Promise<{ savedCount: number; savedIds: string[]; errors: string[] }> {
  if (postings.length === 0) return { savedCount: 0, savedIds: [], errors: [] };

  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  // Parse job descriptions in parallel with bounded concurrency
  const parseTasks = postings.map(
    (posting) => () =>
      parseJobDescription(posting.description_raw, userId).catch(
        (err) => {
          captureException(err, {
            phase: "job-parsing",
            external_id: posting.external_id,
            source: posting.source,
          });
          return { ...DEFAULT_PARSED_FIELDS };
        }
      )
  );
  const parsedResults = await runWithConcurrency(
    parseTasks,
    AI_PARSE_CONCURRENCY
  );

  // Build records for batch insert
  const records = postings.map((posting, i) => {
    const parsedFields = parsedResults[i];
    return {
      external_id: posting.external_id,
      source: posting.source,
      source_url: posting.source_url,
      company_name: posting.company_name,
      job_title: posting.job_title,
      location: posting.location,
      country: posting.country,
      is_remote: posting.is_remote || parsedFields.is_remote,
      job_type: posting.job_type || parsedFields.job_type,
      experience_level:
        posting.experience_level || parsedFields.experience_level,
      salary_min: posting.salary_min ?? parsedFields.salary_min,
      salary_max: posting.salary_max ?? parsedFields.salary_max,
      salary_currency:
        posting.salary_currency ?? parsedFields.salary_currency,
      description_raw: posting.description_raw,
      required_skills:
        posting.required_skills?.length
          ? posting.required_skills
          : parsedFields.required_skills,
      preferred_skills:
        posting.preferred_skills?.length
          ? posting.preferred_skills
          : parsedFields.preferred_skills,
      responsibilities:
        posting.responsibilities?.length
          ? posting.responsibilities
          : parsedFields.responsibilities,
      benefits:
        posting.benefits?.length
          ? posting.benefits
          : parsedFields.benefits,
      application_url: posting.application_url,
      posted_date: posting.posted_date,
      status: "active",
      discovered_at: new Date().toISOString(),
    };
  });

  // Batch upsert — skip conflicts on (source, external_id) unique constraint
  let savedCount = 0;
  const savedIds: string[] = [];
  for (const recordChunk of chunk(records, DEDUP_CHUNK_SIZE)) {
    const { data, error: insertError } = await supabase
      .from("job_postings")
      .upsert(recordChunk, {
        onConflict: "source,external_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      errors.push(`Batch insert failed: ${insertError.message}`);
      captureException(new Error(insertError.message), {
        phase: "batch-save-posting",
        batchSize: recordChunk.length,
      });
    } else {
      savedCount += data?.length ?? 0;
      for (const row of data ?? []) {
        savedIds.push(row.id);
      }
    }
  }

  return { savedCount, savedIds, errors };
}

// ─── Main Discovery Flow ────────────────────────────────────────────────────

export interface DiscoveryRunParams {
  userId: string;
  queries: string[];
  locations: string[];
  countries: string[];
  jobTypes?: string[];
  radius?: number;
  excludedKeywords?: string[];
  excludedCompanies?: string[];
}

export interface DiscoveryRunResult {
  totalFetched: number;
  duplicatesSkipped: number;
  saved: number;
  savedIds: string[];
  errors: string[];
}

/**
 * Filter out postings matching excluded keywords or companies.
 */
function applyExclusions(
  postings: DiscoveryPosting[],
  excludedKeywords: string[],
  excludedCompanies: string[]
): DiscoveryPosting[] {
  if (excludedKeywords.length === 0 && excludedCompanies.length === 0) {
    return postings;
  }

  const lowerExcludedKeywords = excludedKeywords.map((k) => k.toLowerCase());
  const lowerExcludedCompanies = excludedCompanies.map((c) => c.toLowerCase());

  return postings.filter((p) => {
    // Check excluded companies
    if (lowerExcludedCompanies.some((c) => p.company_name.toLowerCase().includes(c))) {
      return false;
    }

    // Check excluded keywords in title and description
    const title = p.job_title.toLowerCase();
    const desc = (p.description_raw || "").toLowerCase();
    if (lowerExcludedKeywords.some((kw) => title.includes(kw) || desc.includes(kw))) {
      return false;
    }

    return true;
  });
}

/**
 * Run a full discovery cycle: fetch from all sources in parallel, deduplicate, parse, and save.
 */
export async function runDiscovery(
  params: DiscoveryRunParams
): Promise<DiscoveryRunResult> {
  const errors: string[] = [];

  // Build all source fetch tasks for parallel execution
  type SourceTask = { label: string; fn: () => Promise<DiscoveryPosting[]> };
  const tasks: SourceTask[] = [];
  let taskCount = 0;

  for (const query of params.queries) {
    for (const location of params.locations.length > 0
      ? params.locations
      : [""]) {
      for (const country of params.countries.length > 0
        ? params.countries
        : [""]) {
        if (taskCount >= MAX_DISCOVERY_API_CALLS) break;

        const loc = location || undefined;
        const ctry = country || undefined;
        const locLabel = location || "any location";

        // SerpAPI Google Jobs
        taskCount++;
        tasks.push({
          label: `Google Jobs: "${query}" in ${locLabel}`,
          fn: () => searchGoogleJobs({ query, location: loc, country: ctry, radius: params.radius }),
        });

        if (taskCount >= MAX_DISCOVERY_API_CALLS) break;

        // JSearch API
        taskCount++;
        tasks.push({
          label: `JSearch: "${query}" in ${locLabel}`,
          fn: () => searchJSearch({ query, location: loc, country: ctry, jobType: params.jobTypes?.join(",") }),
        });
      }
      if (taskCount >= MAX_DISCOVERY_API_CALLS) break;
    }
    if (taskCount >= MAX_DISCOVERY_API_CALLS) break;
  }

  // Add tracked boards as a parallel task
  tasks.push({
    label: "Tracked boards",
    fn: async () => {
      const result = await checkTrackedBoards(params.userId, params.queries);
      errors.push(...result.errors);
      return result.postings;
    },
  });

  // Execute all source fetches in parallel
  const results = await Promise.allSettled(tasks.map((t) => t.fn()));
  const allPostings: DiscoveryPosting[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      allPostings.push(...result.value);
    } else {
      const msg = `${tasks[i].label} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
      errors.push(msg);
      captureException(result.reason, {
        source: tasks[i].label,
        userId: params.userId,
      });
    }
  }

  const totalFetched = allPostings.length;

  // Apply exclusion filters
  const filtered = applyExclusions(
    allPostings,
    params.excludedKeywords ?? [],
    params.excludedCompanies ?? []
  );

  // Deduplicate against existing postings and within batch
  const { newPostings, duplicateCount } =
    await deduplicatePostings(filtered);

  // Parse and save new postings
  const saveResult = await savePostings(newPostings, params.userId);
  errors.push(...saveResult.errors);

  return {
    totalFetched,
    duplicatesSkipped: duplicateCount,
    saved: saveResult.savedCount,
    savedIds: saveResult.savedIds,
    errors,
  };
}
