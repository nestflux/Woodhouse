import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callClaude } from "../_shared/agent-call.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { captureException } from "../_shared/sentry.ts";
import {
  JobParsingSchema,
  type JobParsing,
} from "../_shared/validators/job-parsing.ts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = `You are a job posting parser. You receive the HTML content of a forwarded job alert email. Extract the job posting details from the email.

Output a JSON object with these fields:
- company_name (string, required)
- job_title (string, required)
- location (string or null)
- country (string or null, ISO 3166-1 alpha-2 code)
- is_remote (boolean)
- job_type ("full_time" | "part_time" | "contract" | "freelance" | "internship" | null)
- experience_level ("entry" | "mid" | "senior" | "lead" | "director" | "executive" | null)
- salary_min (integer or null)
- salary_max (integer or null)
- salary_currency (string or null, e.g. "USD")
- description_raw (string, required — full job description text)
- required_skills (array of strings)
- preferred_skills (array of strings)
- responsibilities (array of strings)
- benefits (array of strings)
- application_url (string or null — the URL to apply)
- posted_date (ISO date string or null)

If the email contains multiple job postings, extract only the first/primary one.
If a field cannot be determined from the email, use null or an empty array.
Output ONLY the JSON object, no markdown formatting.`;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

Deno.serve(async (req) => {
  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return jsonResponse({ error: "Server misconfiguration" }, 500);
    }
    if (!authHeader || !authHeader.includes(serviceRoleKey)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { email_html, email_subject, user_id } = body;

    if (!email_html || !user_id) {
      return jsonResponse(
        { error: "email_html and user_id are required" },
        400
      );
    }

    // Truncate very long emails to stay within context limits
    const truncatedHtml =
      email_html.length > 50000 ? email_html.slice(0, 50000) : email_html;

    const userMessage = email_subject
      ? `Email Subject: ${email_subject}\n\nEmail HTML Content:\n${truncatedHtml}`
      : `Email HTML Content:\n${truncatedHtml}`;

    const result = await callClaude({
      agentType: "parse-email-job",
      userId: user_id,
      model: "claude-haiku-4-5",
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 4096,
      temperature: 0,
    });

    // Parse and validate the response
    let parsed: unknown;
    try {
      // Strip markdown code fences if present
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse(
        {
          error: "Failed to parse AI response as JSON",
          raw_response: result.text,
        },
        422
      );
    }

    const validation = JobParsingSchema.safeParse(parsed);
    if (!validation.success) {
      return jsonResponse(
        {
          error: "AI response failed validation",
          validation_errors: validation.error.issues,
          raw_response: result.text,
        },
        422
      );
    }

    return jsonResponse({
      data: validation.data,
      usage: result.usage,
    });
  } catch (error) {
    captureException(error, { context: "parse-email-job" });
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
