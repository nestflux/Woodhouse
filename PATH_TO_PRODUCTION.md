# Woodhouse — Path to Production

Build is complete (44/44 issues, 15/15 epics). This document covers every step from finished codebase to live product.

---

## 1. API Keys & External Services

### Core AI (required for any AI features)

| Key | Service | What It Does |
|-----|---------|--------------|
| `ANTHROPIC_API_KEY` | Anthropic | Powers every AI call: resume parsing (Haiku), pre-screen (Haiku), evaluation (Sonnet), tailoring (Sonnet), materials generation (Sonnet), AI assist (summary, skills, achievements). Without this, the entire pipeline is inert. |

**Get it:** [console.anthropic.com](https://console.anthropic.com) > API Keys

### Job Discovery (required for automated job search)

| Key | Service | What It Does |
|-----|---------|--------------|
| `SERPAPI_API_KEY` | SerpAPI | Primary search engine. The Discovery Agent queries Google Jobs via SerpAPI — searches by role, location, country, and keywords from user preferences. |
| `JSEARCH_API_KEY` | RapidAPI (JSearch) | Secondary search engine. Runs in parallel with SerpAPI for broader job coverage across different sources. |

**Get them:** [serpapi.com](https://serpapi.com) and [rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch](https://rapidapi.com)

### Payments (required for paid tiers)

| Key | Service | What It Does |
|-----|---------|--------------|
| `STRIPE_SECRET_KEY` | Stripe | Server-side: creates checkout sessions, manages subscriptions, handles plan upgrades/downgrades. |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Verifies incoming webhook signatures so the app knows events (payment success, subscription changes, failures) genuinely came from Stripe. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Client-side: initializes Stripe checkout UI on the subscription page. Safe to expose publicly. |

**Get them:** [dashboard.stripe.com](https://dashboard.stripe.com) > Developers > API Keys + Webhooks

### Observability (recommended)

| Key | Service | What It Does |
|-----|---------|--------------|
| `LANGFUSE_SECRET_KEY` | Langfuse | Authenticates with Langfuse for LLM call tracing. Every AI call logs: agent type, user ID, duration, token counts (input/output/cache), cost, success/failure. Feeds the admin dashboard cost estimates. |
| `LANGFUSE_PUBLIC_KEY` | Langfuse | Project identifier — paired with secret key. |
| `LANGFUSE_BASE_URL` | Langfuse | API endpoint. Defaults to `https://cloud.langfuse.com`. Supports self-hosted. |
| `SENTRY_DSN` | Sentry | Error tracking for Edge Functions. Captures exceptions when pipeline jobs fail, AI calls error, or unexpected crashes occur. |

**Get them:** [cloud.langfuse.com](https://cloud.langfuse.com) and [sentry.io](https://sentry.io)

### Email (required for email features)

| Key | Service | What It Does |
|-----|---------|--------------|
| `SENDGRID_API_KEY` | SendGrid | Sends outbound email digests — daily or weekly notification summaries to users. |
| `SENDGRID_WEBHOOK_SECRET` | SendGrid | Verifies inbound email webhooks for the email forwarding feature (users forward job posting emails to Woodhouse for parsing). |
| `SENDGRID_FROM_EMAIL` | SendGrid | Sender address for outbound email. Defaults to `noreply@woodhouse.app`. |

**Get them:** [sendgrid.com](https://sendgrid.com) > Settings > API Keys + Inbound Parse

### Configuration

| Key | Type | What It Does |
|-----|------|--------------|
| `ADMIN_EMAILS` | Comma-separated list | Email addresses that can access `/admin/pipeline` and `/admin/settings`. Example: `you@example.com,cofounder@example.com` |
| `NEXT_PUBLIC_APP_URL` | URL | Your production domain. Used for links in emails and redirects. |

### Priority Order

Get things running incrementally:

1. **`ANTHROPIC_API_KEY`** — Nothing AI works without it
2. **`ADMIN_EMAILS`** — Your email, for admin access
3. **`SERPAPI_API_KEY` + `JSEARCH_API_KEY`** — Job discovery
4. **`STRIPE_*` (3 keys)** — Billing (free tier works without these)
5. **`LANGFUSE_*` (3 keys)** — AI cost tracking
6. **`SENTRY_DSN`** — Error monitoring
7. **`SENDGRID_*` (3 keys)** — Email digests and forwarding

---

## 2. Database Setup

Push all migrations to Supabase:

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase db push --project-ref aultujuuzepnavbvtqmx
```

14 migrations create: 16 tables, RLS policies, triggers, helper functions, and cron schedules.

---

## 3. Edge Function Deployment

Deploy all 12 Supabase Edge Functions:

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy --project-ref aultujuuzepnavbvtqmx
```

Functions: `parse-resume`, `ai-assist`, `discover-jobs`, `trigger-discoveries`, `parse-job-url`, `process-pipeline`, `delete-account`, `generate-resume-files`, `send-email-digest`, `parse-email-job`, `integration-test`, `test-agent`

Set Edge Function secrets:

```bash
npx supabase secrets set \
  ANTHROPIC_API_KEY=sk-... \
  SERPAPI_API_KEY=... \
  JSEARCH_API_KEY=... \
  LANGFUSE_SECRET_KEY=... \
  LANGFUSE_PUBLIC_KEY=... \
  LANGFUSE_BASE_URL=https://cloud.langfuse.com \
  SENTRY_DSN=... \
  SENDGRID_API_KEY=... \
  SENDGRID_FROM_EMAIL=noreply@yourdomain.com \
  --project-ref aultujuuzepnavbvtqmx
```

---

## 4. Stripe Configuration

1. Create three products in Stripe Dashboard matching the pricing tiers:
   - **Free** — $0 (no Stripe product needed)
   - **Pro** — $19/month
   - **Premium** — $39/month
2. Copy the Stripe Price IDs into your app configuration
3. Create a webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`
4. Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## 5. Next.js Deployment

### Option A: Vercel (recommended)

```bash
npm i -g vercel
vercel
```

Set all environment variables in Vercel Dashboard > Settings > Environment Variables.

### Option B: Self-hosted

```bash
npm run build
npm start
```

Run behind a reverse proxy (nginx/Caddy) with SSL.

### Environment Variables for Next.js

Set in `.env.local` (local) or your hosting platform (production):

```
NEXT_PUBLIC_SUPABASE_URL=https://aultujuuzepnavbvtqmx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
ADMIN_EMAILS=you@example.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 6. Domain & DNS

1. Register your domain
2. Point DNS to your hosting platform (Vercel adds this automatically)
3. SSL is handled by the hosting platform
4. Update `NEXT_PUBLIC_APP_URL` to match
5. Update `SENDGRID_FROM_EMAIL` sender domain and verify it in SendGrid

---

## 7. Verification Checklist

Run through this end-to-end after all keys are in place:

- [ ] **Sign up** — Create a new account, verify redirect to onboarding
- [ ] **Onboarding** — Upload a resume (PDF or DOCX), verify parsing extracts data
- [ ] **AI Assist** — Test "Generate Summary", "Suggest Skills", and "Improve Achievement" buttons
- [ ] **Discovery** — Trigger a discovery run, verify jobs appear in Job Feed
- [ ] **Evaluation** — Verify match scores appear on discovered jobs
- [ ] **Tailoring** — Click "Prepare Application" on a job, verify resume/materials generate
- [ ] **Review Queue** — Approve an application, verify files download
- [ ] **Tracker** — Verify approved application appears in tracker, drag between columns
- [ ] **Notifications** — Verify notifications appear in sidebar badge and notification page
- [ ] **Stripe** — Test upgrade to Pro via Stripe checkout (use test mode first)
- [ ] **Admin** — Access `/admin/pipeline` with your admin email, verify dashboard loads
- [ ] **Landing page** — Visit `/`, verify hero, pricing, and CTAs render

---

## 8. Post-Launch

### Recommended

- **CI/CD** — GitHub Actions workflow: lint, type-check, build, deploy on push to main
- **Monitoring** — Verify Langfuse traces appear for AI calls; check Sentry for errors
- **Security audit** — Test RLS (users can't see each other's data), verify no API key leakage
- **Backups** — Supabase handles daily backups; verify backup retention settings

### Future Enhancements

- **Auto-submit (Phase 2)** — Direct API submissions to Greenhouse, Lever, Ashby
- **Analytics** — Posthog or Mixpanel for product analytics
- **Load testing** — Verify concurrent user handling and API rate limits
- **Content/SEO** — Blog posts on job search strategy for organic traffic
