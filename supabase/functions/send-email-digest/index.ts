import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { captureException, captureMessage } from "../_shared/sentry.ts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DigestUser {
  id: string;
  email: string;
  full_name: string;
  email_digest: string;
  last_digest_at: string | null;
}

interface DigestData {
  newMatches: number;
  applicationsReady: number;
  staleApplications: number;
  totalTracked: number;
}

/* ------------------------------------------------------------------ */
/*  Email HTML Template                                                */
/* ------------------------------------------------------------------ */

function buildEmailHtml(
  userName: string,
  data: DigestData,
  frequency: string,
  unsubscribeUrl: string,
  appUrl: string
): string {
  const hasActivity =
    data.newMatches > 0 ||
    data.applicationsReady > 0 ||
    data.staleApplications > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Woodhouse — Your Job Search Update</title>
</head>
<body style="margin:0;padding:0;font-family:'Inter',system-ui,-apple-system,sans-serif;background:#fafaf9;color:#18181b;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e7e5e4;overflow:hidden;">
  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#1e3a5f 0%,#132843 100%);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Woodhouse</h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">Your Job Search Update</p>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:24px 24px 16px;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#18181b;">Hi ${escapeHtml(userName)},</p>
      <p style="margin:8px 0 0;font-size:14px;color:#52525b;line-height:1.6;">
        ${hasActivity ? "Here's what's happened since your last digest:" : "No new activity since your last digest — your search is running smoothly."}
      </p>
    </td>
  </tr>

  ${
    hasActivity
      ? `
  <!-- Stats Grid -->
  <tr>
    <td style="padding:0 24px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${
            data.newMatches > 0
              ? `<td style="padding:4px;">
            <div style="background:rgba(30,58,95,0.05);border:1px solid rgba(30,58,95,0.1);border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#1e3a5f;">${data.newMatches}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#52525b;">New Matches</p>
            </div>
          </td>`
              : ""
          }
          ${
            data.applicationsReady > 0
              ? `<td style="padding:4px;">
            <div style="background:rgba(5,150,105,0.05);border:1px solid rgba(5,150,105,0.1);border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#059669;">${data.applicationsReady}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#52525b;">Ready to Review</p>
            </div>
          </td>`
              : ""
          }
          ${
            data.staleApplications > 0
              ? `<td style="padding:4px;">
            <div style="background:rgba(217,119,6,0.05);border:1px solid rgba(217,119,6,0.1);border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#d97706;">${data.staleApplications}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#52525b;">Need Follow-up</p>
            </div>
          </td>`
              : ""
          }
        </tr>
      </table>
    </td>
  </tr>
  `
      : ""
  }

  ${
    data.totalTracked > 0
      ? `
  <!-- Tracked Summary -->
  <tr>
    <td style="padding:0 24px 24px;">
      <p style="margin:0;font-size:13px;color:#a1a1aa;">You currently have ${data.totalTracked} application${data.totalTracked !== 1 ? "s" : ""} being tracked.</p>
    </td>
  </tr>
  `
      : ""
  }

  <!-- CTA Button -->
  <tr>
    <td style="padding:0 24px 32px;text-align:center;">
      <a href="${escapeHtml(appUrl)}/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
        Open Dashboard
      </a>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:20px 24px;border-top:1px solid #e7e5e4;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
        You're receiving this because you have ${escapeHtml(frequency)} email digests enabled.<br>
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#d97706;text-decoration:underline;">Unsubscribe</a> from email digests.
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#a1a1aa;">
        Woodhouse — AI-Powered Job Application Agent
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ------------------------------------------------------------------ */
/*  Digest Data Aggregation                                            */
/* ------------------------------------------------------------------ */

async function getDigestData(
  userId: string,
  since: Date
): Promise<DigestData> {
  const supabase = getSupabaseAdmin();

  const [matchesResult, readyResult, staleResult, trackedResult] =
    await Promise.all([
      // New matches since last digest
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .gte("created_at", since.toISOString()),

      // Applications ready for review
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .eq("status", "ready"),

      // Stale applications (submitted > 14 days, no response)
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .eq("status", "submitted")
        .lt(
          "updated_at",
          new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        ),

      // Total tracked applications
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .in("status", [
          "submitted",
          "acknowledged",
          "screening",
          "interviewing",
          "offer",
        ]),
    ]);

  return {
    newMatches: matchesResult.count ?? 0,
    applicationsReady: readyResult.count ?? 0,
    staleApplications: staleResult.count ?? 0,
    totalTracked: trackedResult.count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Send Email via SendGrid                                            */
/* ------------------------------------------------------------------ */

async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridApiKey) {
    console.error("SENDGRID_API_KEY not set — skipping email send");
    return false;
  }

  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@woodhouse.app";
  const fromName = "Woodhouse";

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/html", value: htmlContent }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SendGrid error (${response.status}): ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Main Handler                                                       */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  try {
    // Verify authorization (service role only)
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!authHeader || !authHeader.includes(serviceRoleKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();
    const appUrl =
      Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://app.woodhouse.app";

    const now = new Date();
    const isMonday = now.getUTCDay() === 1;

    // Fetch users who need a digest
    // Daily users: send every day
    // Weekly users: send on Mondays only
    let query = supabase
      .from("profiles")
      .select("id, email, full_name, email_digest, last_digest_at")
      .neq("email_digest", "none")
      .eq("onboarding_complete", true);

    if (!isMonday) {
      // On non-Mondays, only send to daily users
      query = query.eq("email_digest", "daily");
    }

    const { data: users, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No users to send digest to" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    let errorCount = 0;

    for (const user of users as DigestUser[]) {
      try {
        // Determine since when to aggregate data
        const since = user.last_digest_at
          ? new Date(user.last_digest_at)
          : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

        const digestData = await getDigestData(user.id, since);

        // Skip if no activity and no tracked applications
        if (
          digestData.newMatches === 0 &&
          digestData.applicationsReady === 0 &&
          digestData.staleApplications === 0 &&
          digestData.totalTracked === 0
        ) {
          continue;
        }

        const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?uid=${user.id}`;
        const frequency = user.email_digest === "daily" ? "daily" : "weekly";
        const subject =
          digestData.newMatches > 0
            ? `${digestData.newMatches} new job match${digestData.newMatches !== 1 ? "es" : ""} — Your ${frequency} Woodhouse digest`
            : `Your ${frequency} Woodhouse digest`;

        const html = buildEmailHtml(
          user.full_name || "there",
          digestData,
          frequency,
          unsubscribeUrl,
          appUrl
        );

        const sent = await sendEmail(user.email, subject, html);

        if (sent) {
          sentCount++;
          // Update last_digest_at
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ last_digest_at: now.toISOString() })
            .eq("id", user.id);

          if (updateError) {
            captureMessage("Failed to update last_digest_at", {
              userId: user.id,
              error: updateError.message,
            });
          }
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        captureException(error, {
          userId: user.id,
          email: user.email,
          context: "send-email-digest",
        });
      }
    }

    const result = {
      sent: sentCount,
      errors: errorCount,
      total_users: users.length,
      is_monday: isMonday,
    };

    if (errorCount > 0) {
      captureMessage(`Email digest completed with ${errorCount} errors`, result);
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    captureException(error, { context: "send-email-digest" });
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
