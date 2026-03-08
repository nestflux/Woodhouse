import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callClaude, RetryableError } from "../_shared/agent-call.ts";
import { JobParsingSchema } from "../_shared/validators/job-parsing.ts";
import { captureException, captureMessage } from "../_shared/sentry.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH = 100_000;

const LOGIN_WALL_INDICATORS = [
  "sign in to continue",
  "log in to continue",
  "login required",
  "please sign in",
  "please log in",
  "create an account",
  "authentication required",
  "access denied",
  "403 forbidden",
  "401 unauthorized",
];

const SYSTEM_PROMPT = `You are a job posting parser. Extract structured data from job posting HTML/text content.

## Output Format
Return a JSON object with these fields:
{
  "company_name": "string — the hiring company name",
  "job_title": "string — the job title/position",
  "location": "string | null — city, state/province, or country",
  "country": "string | null — ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'DE')",
  "is_remote": "boolean — true if the job allows remote work",
  "job_type": "full_time | part_time | contract | freelance | internship | null",
  "experience_level": "entry | mid | senior | lead | director | executive | null",
  "salary_min": "number | null — minimum salary as integer",
  "salary_max": "number | null — maximum salary as integer",
  "salary_currency": "string | null — ISO 4217 currency code (e.g., 'USD', 'EUR')",
  "description_raw": "string — the full job description as clean text (no HTML tags)",
  "required_skills": ["array of required skill strings"],
  "preferred_skills": ["array of preferred/nice-to-have skill strings"],
  "responsibilities": ["array of responsibility strings"],
  "benefits": ["array of benefit strings"],
  "application_url": "string | null — direct application URL if found"
}

## Rules
- Extract ALL available information. If a field is not found, use null.
- For description_raw: strip all HTML tags, keep the text content, preserve paragraph breaks.
- For skills: extract from requirements/qualifications sections. Separate required vs preferred.
- For salary: extract numbers only. Convert "100k" to 100000. If range given, set both min and max.
- For location: include city and state/country. If multiple locations, pick the primary one.
- For country: infer from the location, company HQ, or job listing context.
- For job_type: map common terms — "Full-time" → "full_time", "Part-time" → "part_time", etc.
- For experience_level: infer from title and requirements — "Junior" → "entry", "Senior" → "senior", etc.
- Return ONLY the JSON object, no additional text or markdown.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function isLoginWall(content: string): boolean {
  const lower = content.toLowerCase();
  // Check if the content is very short (likely a redirect/error page) AND contains login indicators
  const hasLoginIndicator = LOGIN_WALL_INDICATORS.some((indicator) =>
    lower.includes(indicator)
  );
  // Short page with login indicators, or page is mostly a login form
  return hasLoginIndicator && content.length < 10000;
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

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const token = authHeader.substring(7);
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

    const body = (await req.json().catch(() => null)) as {
      url?: string;
    } | null;

    if (!body?.url || typeof body.url !== "string") {
      return jsonResponse({ error: "URL is required" }, 400);
    }

    const url = body.url.trim();

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return jsonResponse(
          { error: "URL must start with http:// or https://" },
          400
        );
      }
    } catch {
      return jsonResponse({ error: "Invalid URL format" }, 400);
    }

    // SSRF protection: reject private/internal hostnames
    const hostname = parsedUrl.hostname.toLowerCase();
    const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
    const BLOCKED_PREFIXES = ["10.", "172.16.", "172.17.", "172.18.", "172.19.",
      "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
      "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
      "192.168.", "169.254."];
    if (
      BLOCKED_HOSTS.includes(hostname) ||
      BLOCKED_PREFIXES.some((prefix) => hostname.startsWith(prefix)) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return jsonResponse({ error: "Invalid URL: private addresses are not allowed" }, 400);
    }

    // Fetch the URL content
    let pageContent: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS
      );

      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Woodhouse/1.0; +https://woodhouse.app)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return jsonResponse(
            {
              error:
                "This page requires authentication. Please use the Manual Entry tab to paste the job description directly.",
            },
            422
          );
        }
        return jsonResponse(
          { error: `Failed to fetch URL (HTTP ${response.status})` },
          422
        );
      }

      const text = await response.text();
      pageContent = text.substring(0, MAX_CONTENT_LENGTH);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return jsonResponse(
          {
            error:
              "The page took too long to load. Please use the Manual Entry tab to paste the job description directly.",
          },
          422
        );
      }
      return jsonResponse(
        {
          error:
            "Could not fetch the URL. Please check the URL and try again, or use the Manual Entry tab.",
        },
        422
      );
    }

    // Check for login walls
    if (isLoginWall(pageContent)) {
      return jsonResponse(
        {
          error:
            "This page appears to require a login. Please use the Manual Entry tab to paste the job description directly.",
        },
        422
      );
    }

    // Call Haiku to parse the content
    const result = await callClaude({
      agentType: "job-url-parser",
      userId: user.id,
      model: "claude-haiku-4-5",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Parse this job posting page content and extract structured data:\n\nURL: ${url}\n\n${pageContent}`,
      maxTokens: 2048,
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
      captureMessage("parse-job-url: Haiku returned invalid JSON", {
        userId: user.id,
        url,
        textPreview: cleanText.substring(0, 200),
      });
      return jsonResponse(
        {
          error:
            "Could not parse the job posting content. Please use the Manual Entry tab.",
        },
        422
      );
    }

    const validated = JobParsingSchema.safeParse(parsed);
    if (!validated.success) {
      captureMessage("parse-job-url: Zod validation failed", {
        userId: user.id,
        url,
        error: validated.error.message,
      });
      return jsonResponse(
        {
          error:
            "Could not extract complete job data. Please use the Manual Entry tab.",
        },
        422
      );
    }

    // Include the source URL as application_url if not found in the content
    const data = validated.data;
    if (!data.application_url) {
      data.application_url = url;
    }

    return jsonResponse({ data });
  } catch (error) {
    captureException(error, { function: "parse-job-url" });
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof RetryableError) {
      return jsonResponse({ error: "Service temporarily unavailable. Please try again." }, 503);
    }

    return jsonResponse({ error: message }, 500);
  }
});
