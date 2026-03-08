import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  SendGrid Inbound Parse Webhook Handler                             */
/* ------------------------------------------------------------------ */

/**
 * Verify SendGrid webhook signature.
 * SendGrid sends a signed payload with a public key verification.
 * For Inbound Parse, we verify using the webhook secret.
 */
function verifySendGridSignature(
  body: string,
  signature: string | null
): boolean {
  const secret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (!secret) {
    console.error("SENDGRID_WEBHOOK_SECRET not configured");
    return false;
  }

  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  let rawBody = "";

  try {
    // SendGrid Inbound Parse sends multipart/form-data
    const contentType = request.headers.get("content-type") ?? "";

    let toAddress = "";
    let fromAddress = "";
    let subject = "";
    let htmlBody = "";
    let textBody = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      toAddress = (formData.get("to") as string) ?? "";
      fromAddress = (formData.get("from") as string) ?? "";
      subject = (formData.get("subject") as string) ?? "";
      htmlBody = (formData.get("html") as string) ?? "";
      textBody = (formData.get("text") as string) ?? "";
      rawBody = JSON.stringify(Object.fromEntries(formData));
    } else {
      rawBody = await request.text();
      try {
        const json = JSON.parse(rawBody);
        toAddress = json.to ?? "";
        fromAddress = json.from ?? "";
        subject = json.subject ?? "";
        htmlBody = json.html ?? "";
        textBody = json.text ?? "";
      } catch {
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 }
        );
      }
    }

    // Verify webhook signature (only when secret is configured)
    const webhookSignature = request.headers.get("x-twilio-email-event-webhook-signature");
    if (process.env.SENDGRID_WEBHOOK_SECRET) {
      if (!verifySendGridSignature(rawBody, webhookSignature)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Extract the forwarding address from the "to" field
    // Format: "jobs+{short_id}@inbound.woodhouse.app" or with display name
    const addressMatch = toAddress.match(
      /<?([^<>\s]+@[^<>\s]+)>?/
    );
    const recipientEmail = addressMatch?.[1]?.toLowerCase() ?? "";

    if (!recipientEmail) {
      // No valid recipient — log and discard
      console.warn("Inbound email: no valid recipient address found", {
        to: toAddress,
      });
      return NextResponse.json({ status: "discarded", reason: "no_recipient" });
    }

    // Look up user by forwarding address
    const supabase = createClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("forwarding_address", recipientEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to look up forwarding address:", profileError.message);
      return NextResponse.json(
        { error: "Internal error" },
        { status: 500 }
      );
    }

    if (!profile) {
      // Unrecognized forwarding address — log and discard (no error response)
      console.warn("Inbound email: unrecognized forwarding address", {
        recipient: recipientEmail,
        from: fromAddress,
      });
      return NextResponse.json({
        status: "discarded",
        reason: "unrecognized_address",
      });
    }

    const userId = profile.id;
    const emailContent = htmlBody || textBody;

    if (!emailContent) {
      // No content to parse — notify user
      await supabase.rpc("create_notification", {
        p_profile_id: userId,
        p_type: "system",
        p_title: "Forwarded email could not be processed",
        p_body: `We received a forwarded email from ${fromAddress} but it had no content to parse.`,
        p_metadata: { from: fromAddress, subject },
      });

      return NextResponse.json({
        status: "discarded",
        reason: "no_content",
      });
    }

    // Call the parse-email-job Edge Function to extract job details
    const { data: parseFnData, error: parseFnError } =
      await supabase.functions.invoke("parse-email-job", {
        body: {
          email_html: emailContent,
          email_subject: subject,
          user_id: userId,
        },
      });

    const parseResult = parseFnData as
      | { data?: Record<string, unknown>; error?: string }
      | null;

    if (parseFnError || !parseResult?.data) {
      // Parse failed — save raw email data to job_postings as a failed record
      await supabase.from("job_postings").insert({
        company_name: "(parse failed)",
        job_title: subject || "(forwarded email)",
        description_raw: emailContent.slice(0, 10000),
        source: "email",
        source_url: `mailto:${fromAddress}`,
        external_id: `email_failed_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        status: "removed",
        raw_data: {
          from: fromAddress,
          subject,
          html: htmlBody.slice(0, 50000),
          text: textBody.slice(0, 10000),
          forwarding_address: recipientEmail,
          parse_error: parseFnError?.message ?? parseResult?.error ?? "Unknown",
          received_at: new Date().toISOString(),
        },
      });

      // Notify user
      await supabase.rpc("create_notification", {
        p_profile_id: userId,
        p_type: "system",
        p_title: "Forwarded email could not be parsed",
        p_body: `We received your forwarded email "${subject || "(no subject)"}" but couldn't extract job details. Our team has been notified.`,
        p_metadata: {
          from: fromAddress,
          subject,
          error: parseFnError?.message ?? parseResult?.error ?? "Unknown",
        },
      });

      return NextResponse.json({
        status: "parse_failed",
        error: parseFnError?.message ?? parseResult?.error,
      });
    }

    const jobData = parseResult.data;

    // Check for duplicate — same company + title from email source for this user
    const { data: existingJob } = await supabase
      .from("job_postings")
      .select("id")
      .eq("company_name", jobData.company_name)
      .eq("job_title", jobData.job_title)
      .eq("source", "email")
      .maybeSingle();

    if (existingJob) {
      // Job already exists — still enqueue pipeline for this user
      await supabase.from("pipeline_jobs").insert({
        profile_id: userId,
        job_posting_id: existingJob.id,
        step: "pre_screen",
        status: "pending",
        input_data: {
          source: "email",
          from: fromAddress,
          subject,
          duplicate: true,
        },
      });

      return NextResponse.json({
        status: "duplicate_enqueued",
        job_posting_id: existingJob.id,
      });
    }

    // Save job posting
    const { data: newJob, error: jobError } = await supabase
      .from("job_postings")
      .insert({
        company_name: jobData.company_name,
        job_title: jobData.job_title,
        location: jobData.location ?? null,
        country: jobData.country ?? null,
        is_remote: jobData.is_remote ?? false,
        job_type: jobData.job_type ?? null,
        experience_level: jobData.experience_level ?? null,
        salary_min: jobData.salary_min ?? null,
        salary_max: jobData.salary_max ?? null,
        salary_currency: jobData.salary_currency ?? null,
        description_raw: jobData.description_raw,
        required_skills: jobData.required_skills ?? [],
        preferred_skills: jobData.preferred_skills ?? [],
        responsibilities: jobData.responsibilities ?? [],
        benefits: jobData.benefits ?? [],
        application_url: jobData.application_url ?? null,
        source: "email",
        source_url: `mailto:${fromAddress}`,
        external_id: `email_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        posted_date: jobData.posted_date ?? null,
        status: "active",
        raw_data: {
          from: fromAddress,
          subject,
          forwarding_address: recipientEmail,
          parsed_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (jobError || !newJob) {
      console.error("Failed to create job posting:", jobError?.message);
      return NextResponse.json(
        { error: "Failed to save job posting" },
        { status: 500 }
      );
    }

    // Enqueue pipeline job with step='pre_screen'
    const { error: pipelineError } = await supabase
      .from("pipeline_jobs")
      .insert({
        profile_id: userId,
        job_posting_id: newJob.id,
        step: "pre_screen",
        status: "pending",
        input_data: {
          source: "email",
          from: fromAddress,
          subject,
        },
      });

    if (pipelineError) {
      console.error("Failed to enqueue pipeline job:", pipelineError.message);
      // Job posting is saved — pipeline job can be manually retried
    }

    return NextResponse.json({
      status: "processed",
      job_posting_id: newJob.id,
    });
  } catch (error) {
    console.error("Email inbound webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
