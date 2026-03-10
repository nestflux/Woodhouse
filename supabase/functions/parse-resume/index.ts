import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callClaude } from "../_shared/agent-call.ts";
import { callAgent } from "../_shared/langfuse.ts";
import { ResumeParsingSchema } from "../_shared/validators/resume-parsing.ts";
import { captureException } from "../_shared/sentry.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import mammoth from "npm:mammoth@1";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const MIN_EXTRACTABLE_TEXT_LENGTH = 20;

const SYSTEM_PROMPT = `You are a resume parsing assistant. Extract structured data from the resume provided.

Return a JSON object with the following fields (include only what you can extract — omit fields that are not present in the resume):

{
  "full_name": "string",
  "phone": "string",
  "location": "string — city/region",
  "country": "string — full country name",
  "linkedin_url": "string",
  "portfolio_url": "string",
  "github_url": "string",
  "headline": "string — professional title/role, e.g. 'Senior Software Engineer'",
  "summary": "string — professional summary if present",
  "work_experiences": [
    {
      "company_name": "string",
      "job_title": "string",
      "location": "string",
      "country": "string",
      "start_date": "YYYY-MM-DD or YYYY-MM or YYYY",
      "end_date": "YYYY-MM-DD or YYYY-MM or YYYY, or null if current",
      "is_current": true/false,
      "description": "string — role description if present",
      "achievements": [
        { "description": "string — individual bullet point" }
      ]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string — e.g. 'Bachelor of Science'",
      "field_of_study": "string — e.g. 'Computer Science'",
      "start_date": "YYYY-MM-DD or YYYY-MM or YYYY",
      "end_date": "YYYY-MM-DD or YYYY-MM or YYYY",
      "gpa": number or null
    }
  ],
  "skills": [
    {
      "name": "string",
      "category": "technical" | "soft" | "language" | "certification" | "tool" | "framework" | "other",
      "proficiency": "beginner" | "intermediate" | "advanced" | "expert",
      "years_experience": number or null
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "url": "string",
      "technologies": ["string"]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "issue_date": "YYYY-MM-DD or YYYY-MM or YYYY",
      "expiry_date": "YYYY-MM-DD or YYYY-MM or YYYY",
      "credential_url": "string"
    }
  ]
}

Rules:
- Infer skill categories and proficiency levels from context when possible.
- For dates, normalize to YYYY-MM-DD format when the exact day is available, YYYY-MM when only month/year, or YYYY when only year.
- If a job has no end date and appears to be the most recent, set is_current to true.
- Extract achievement bullets as individual items, not combined paragraphs.
- Return ONLY the JSON object, no additional text or markdown.`;

function getUserFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

/**
 * Parse a PDF by sending it as a base64 document block to Claude.
 * Uses the Anthropic API's native PDF support for accurate text extraction.
 */
async function parsePdf(
  fileData: Blob,
  userId: string
): Promise<{ text: string; usage: Record<string, number>; model: string }> {
  const arrayBuffer = await fileData.arrayBuffer();
  const base64Data = encodeBase64(new Uint8Array(arrayBuffer));

  const result = await callAgent(
    "resume-parser",
    {
      model: "claude-haiku-4-5",
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Parse this resume and extract structured data as JSON.",
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0,
    },
    userId
  );

  const textBlock = result.content.find(
    (block: { type: string }) => block.type === "text"
  );
  const text =
    textBlock && "text" in textBlock ? (textBlock as { text: string }).text : "";

  return { text, usage: result.usage, model: result.model };
}

/**
 * Parse a DOCX by extracting text with mammoth, then sending to Claude.
 */
async function parseDocx(
  fileData: Blob,
  userId: string
): Promise<{ text: string; usage: Record<string, number>; model: string }> {
  const arrayBuffer = await fileData.arrayBuffer();
  const extracted = await mammoth.extractRawText({ buffer: arrayBuffer });
  const textContent = extracted.value as string;

  if (!textContent || textContent.trim().length < MIN_EXTRACTABLE_TEXT_LENGTH) {
    throw new Error(
      "Could not extract text from the DOCX file. Please ensure it contains readable text."
    );
  }

  const result = await callClaude({
    agentType: "resume-parser",
    userId,
    model: "claude-haiku-4-5",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Parse the following resume and extract structured data:\n\n${textContent}`,
    maxTokens: 4096,
    temperature: 0,
  });

  return result;
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

  try {
    const token = getUserFromRequest(req);
    if (!token) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    // Use the service role client for both auth verification and file download.
    // The user-scoped client fails with ES256 JWTs on newer Supabase projects.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const filePath = body.file_path as string;
    if (!filePath) {
      return jsonResponse({ error: "file_path is required" }, 400);
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return jsonResponse({ error: "Access denied" }, 403);
    }

    const { data: fileData, error: downloadError } = await admin.storage
      .from("resumes")
      .download(filePath);

    if (downloadError || !fileData) {
      return jsonResponse(
        {
          error: `Failed to download resume: ${downloadError?.message ?? "Unknown error"}`,
        },
        400
      );
    }

    // Route to the appropriate parser based on file type
    let result: { text: string; usage: Record<string, number>; model: string };

    if (filePath.endsWith(".pdf")) {
      result = await parsePdf(fileData, user.id);
    } else {
      result = await parseDocx(fileData, user.id);
    }

    // Parse and validate the AI response
    let parsedData: unknown;
    try {
      let cleanText = result.text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }
      parsedData = JSON.parse(cleanText);
    } catch {
      return jsonResponse(
        { error: "Failed to parse AI response as JSON" },
        500
      );
    }

    const validated = ResumeParsingSchema.safeParse(parsedData);
    if (!validated.success) {
      return jsonResponse(
        {
          error: `Parsed data validation failed: ${validated.error.message}`,
        },
        500
      );
    }

    // Save parsed data to profile
    const { error: updateError } = await admin
      .from("profiles")
      .update({ resume_parsed_data: validated.data })
      .eq("id", user.id);

    if (updateError) {
      return jsonResponse(
        { error: `Failed to save parsed data: ${updateError.message}` },
        500
      );
    }

    // Build summary counts
    const data = validated.data;
    const summary = {
      work_experiences: data.work_experiences?.length ?? 0,
      education: data.education?.length ?? 0,
      skills: data.skills?.length ?? 0,
      projects: data.projects?.length ?? 0,
      certifications: data.certifications?.length ?? 0,
      has_contact_info: !!(data.full_name || data.phone || data.location),
      has_headline: !!data.headline,
      has_summary: !!data.summary,
    };

    return jsonResponse({ data: validated.data, summary, usage: result.usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureException(error, { function: "parse-resume" });
    return jsonResponse({ error: message }, 500);
  }
});
