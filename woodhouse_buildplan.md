# Woodhouse — Build Plan

> **Version:** 1.0
> **Date:** 2026-03-07
> **Masterplan:** `woodhouse_masterplan.md` v1.2
> **Purpose:** Claude Code implementation guide — epics, issues, and acceptance criteria ordered by dependency.

---

## How to Use This Document

1. Read the referenced masterplan sections (`MP §X`) **before writing any code** for that issue.
2. Complete **all** acceptance criteria before marking an issue done.
3. Never proceed to the next issue if current acceptance criteria are not met.
4. Issues within an epic are ordered by dependency — do not skip ahead.
5. Run the Three-Gate Autonomous Review after each issue (see CLAUDE.md).

---

## Epics Overview

| Epic | Title | Issues | Status | Description |
|------|-------|--------|--------|-------------|
| E1 | Development Environment | 3 | DONE | Next.js + Supabase + Tailwind project setup |
| E2 | Database & Auth | 5 | DONE | All tables, RLS, triggers, auth flow, app shell |
| E3 | AI Pipeline Infrastructure | 4 | DONE | Anthropic SDK, Langfuse, Zod schemas, pipeline queue worker |
| E4 | Onboarding | 2 | NEXT | 8-step onboarding wizard, AI assist, resume upload |
| E5 | Job Discovery | 3 | — | Discovery Agent, ATS boards, cron scheduling |
| E6 | Job Evaluation | 3 | — | Haiku pre-screen, Sonnet evaluation, manual job input |
| E7 | Resume Tailoring & Materials | 3 | — | Tailoring Agent, Materials Agent, end-to-end pipeline test |
| E8 | Review Queue & File Generation | 4 | — | Resume files, review queue, application detail, approve flow |
| E9 | Dashboard, Job Feed & Tailoring Config | 4 | — | Dashboard, job feed, job detail, tailoring prompt customization |
| E10 | Application Tracker | 2 | — | Kanban board, tracker detail |
| E11 | Notifications & Email | 3 | — | In-app notifications, email digest, email forwarding |
| E12 | Subscription & Payments | 3 | — | Stripe setup, subscription management, usage enforcement |
| E13 | Settings | 2 | — | Profile/preferences settings, account settings |
| E14 | Admin & Observability | 1 | — | Pipeline admin dashboard |
| E15 | Landing Page & Polish | 2 | — | Marketing page, loading/empty/error states, responsive polish |

**Total: 44 issues**

---

## Critical Path

```
E1-01 → E1-02 → E1-03 → E2-01 → E2-02 → E2-03 → E2-04 → E2-05
→ E3-01 → E3-02 → E3-03 → E3-04 → E4-01 → E4-02
→ E5-01 → E5-02 → E5-03 → E6-01 → E6-02 → E6-03
→ E7-01 → E7-02 → E7-03 → E8-01 → E8-02 → E8-03 → E8-04
→ E9-01 → E9-02 → E9-03 → E9-04 → E10-01 → E10-02
→ E11-01 → E11-02 → E11-03 → E12-01 → E12-02 → E12-03
→ E13-01 → E13-02 → E14-01 → E15-01 → E15-02
```

---

# E1 — Development Environment

## E1-01 — Next.js Project Initialization

**Type:** Setup
**Depends on:** Nothing
**Masterplan:** MP §6 Stack

### Description

Create a new Next.js 14+ project with App Router, Tailwind CSS, and shadcn/ui. This is the foundation everything else builds on.

### Implementation Notes

- Use `npx create-next-app@latest woodhouse --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`.
- Initialize shadcn/ui with `npx shadcn@latest init`. Select the "New York" style, slate base color, CSS variables enabled.
- Add the Inter font from Google Fonts via `next/font/google` in the root layout (not a CDN link).
- Set up path aliases: `@/components`, `@/lib`, `@/app`, `@/types`.
- Create folder structure:
  ```
  src/
    app/
      (auth)/          # Auth routes (no sidebar)
      (app)/           # Authenticated routes (sidebar layout)
      (marketing)/     # Public marketing pages
      api/             # API routes (webhooks)
    components/
      ui/              # shadcn/ui components
    lib/
      supabase/        # Supabase client utilities
      agents/          # AI agent functions (used by Edge Functions)
      validators/      # Zod schemas
    types/             # TypeScript types
  supabase/
    functions/         # Edge Functions
    migrations/        # SQL migrations
  ```

### Acceptance Criteria

- [x] `npm run dev` starts the dev server without errors on `http://localhost:3000`
- [x] Tailwind CSS is working: a test element with `className="text-blue-500"` renders in blue
- [x] shadcn/ui is initialized: `npx shadcn@latest add button` adds a working Button component
- [x] Inter font is loaded via `next/font/google` and applied as the default body font
- [x] The folder structure matches the specification above
- [x] TypeScript strict mode is enabled in `tsconfig.json`
- [x] `@/*` import alias resolves correctly (e.g., `import { Button } from "@/components/ui/button"`)

---

## E1-02 — Supabase Project Setup

**Type:** Setup
**Depends on:** E1-01
**Masterplan:** MP §6 Stack, §6 Key Architectural Decisions

### Description

Set up Supabase for local development and configure the three Supabase client patterns (server, browser, edge function) used throughout the app.

### Implementation Notes

- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Install Supabase CLI: `npx supabase init` in the project root.
- Create three client utility files in `src/lib/supabase/`:
  - `server.ts` — `createServerClient` from `@supabase/ssr` with cookie-based auth. For Server Components, Server Actions, API Routes.
  - `client.ts` — `createBrowserClient` from `@supabase/ssr`. For Client Components (realtime, optimistic updates).
  - `admin.ts` — `createClient` from `@supabase/supabase-js` with service role key. For Edge Functions only. **Never import this from frontend code.**
- Create middleware (`src/middleware.ts`) that refreshes the Supabase auth session on every request.
- Start Supabase locally with `npx supabase start`.

### Acceptance Criteria

- [x] `npx supabase start` launches local Supabase (Postgres, Auth, Storage, Edge Functions)
- [x] `src/lib/supabase/server.ts` exports a `createClient()` function that uses `createServerClient` with cookies
- [x] `src/lib/supabase/client.ts` exports a `createClient()` function that uses `createBrowserClient`
- [x] `src/lib/supabase/admin.ts` exports a `createClient()` function using the service role key
- [x] `src/middleware.ts` refreshes the auth session and is configured in `middleware` matcher
- [x] A test Server Component can query `auth.getUser()` and return the session state

---

## E1-03 — Environment Variables & Dev Tooling

**Type:** Setup
**Depends on:** E1-02
**Masterplan:** MP §6 Environment Variables

### Description

Configure all environment variables and development tooling (linting, formatting, Git hooks).

### Implementation Notes

- Create `.env.local` with all variables from MP §6 Environment Variables table. Use Supabase local dev values for `SUPABASE_*` vars. Use placeholder values for external APIs (`SERPAPI_API_KEY`, etc.).
- Create `.env.example` with all variable names and descriptions (no values).
- Verify `.gitignore` excludes `.env.local`, `node_modules`, `.next`, `supabase/.temp`.
- Add Prettier with Tailwind plugin (`prettier-plugin-tailwindcss`).
- Configure ESLint with Next.js recommended rules.

### Acceptance Criteria

- [x] `.env.local` contains all 15 environment variables from MP §6
- [x] `.env.example` documents every variable with its purpose and where it's used
- [x] `.env.local` is in `.gitignore`
- [x] `NEXT_PUBLIC_*` variables are accessible in client components
- [x] Non-`NEXT_PUBLIC_*` variables are NOT accessible in client components (verified by test)
- [x] Prettier formats on save with Tailwind class sorting
- [x] `npm run lint` passes with zero warnings

---

# E2 — Database & Auth

## E2-01 — Core Profile Schema

**Type:** Schema
**Depends on:** E1-03
**Masterplan:** MP §7 (Profiles, Work Experiences, Achievements, Education, Skills, Projects, Certifications)

### Description

Create the user profile and knowledge base tables. These store everything about a user's professional background — the foundation for all AI operations.

### Implementation Notes

- Create a Supabase migration file for all 7 tables: `profiles`, `work_experiences`, `achievements`, `education`, `skills`, `projects`, `certifications`.
- Copy the exact SQL from MP §7 — column names, types, constraints, CHECK constraints, defaults.
- Include all RLS policies exactly as specified.
- Include all indexes.
- Do NOT include triggers or functions yet (E2-03).
- Run the migration locally and verify with `npx supabase db diff`.

### Acceptance Criteria

- [x] Migration creates all 7 tables with exact columns, types, and constraints from MP §7
- [x] `profiles` includes `country TEXT`, `target_countries TEXT[] DEFAULT '{}'`
- [x] `work_experiences` includes `country TEXT`
- [x] RLS is enabled on all 7 tables
- [x] RLS policies enforce user-can-only-access-own-data on all tables
- [x] `profiles.id` is a FK referencing `auth.users(id)` with `ON DELETE CASCADE`
- [x] `achievements.work_experience_id` cascades deletes from `work_experiences`
- [x] All CHECK constraints are present: `remote_preference`, `category`, `proficiency`, `email_digest`
- [x] All indexes from MP §7 are created
- [x] Migration applies cleanly: `npx supabase db reset` succeeds without errors

---

## E2-02 — Application & Pipeline Schema

**Type:** Schema
**Depends on:** E2-01
**Masterplan:** MP §7 (Search Preferences, Tracked Boards, Job Postings, Job Evaluations, Applications, Resume Versions, Application Events, Pipeline Jobs, Discovery Runs)

### Description

Create the job discovery, evaluation, application pipeline, and queue tables. These power the entire automated workflow.

### Implementation Notes

- Create a migration for all 9 tables: `search_preferences`, `tracked_boards`, `job_postings`, `job_evaluations`, `applications`, `resume_versions`, `application_events`, `pipeline_jobs`, `discovery_runs`.
- `job_postings` has NO RLS — shared across users (documented in MP §7).
- `pipeline_jobs` has NO RLS — managed by Edge Functions with service role key.
- `search_preferences` includes `next_discovery_at TIMESTAMPTZ DEFAULT now()` (no `scan_interval_hours`).
- `pipeline_jobs.step` CHECK includes: `'pre_screen', 'evaluate', 'tailor', 'generate_materials', 'generate_files'`.
- Include all indexes, including partial indexes (`WHERE status = 'pending'`, `WHERE status = 'processing'`, `WHERE read = FALSE`).

### Acceptance Criteria

- [x] Migration creates all 9 tables with exact columns, types, and constraints from MP §7
- [x] `search_preferences` includes `salary_currency TEXT DEFAULT 'USD'`
- [x] `job_postings` includes `country TEXT` and `salary_currency TEXT DEFAULT 'USD'`
- [x] `job_postings` and `pipeline_jobs` have RLS enabled but NO restrictive policies (service role access)
- [x] All other tables have RLS with user-scoped policies
- [x] `search_preferences` has `UNIQUE(profile_id)` and `next_discovery_at` column
- [x] `tracked_boards` has `UNIQUE(profile_id, board_url)`
- [x] `pipeline_jobs` has partial indexes for queue (`WHERE status = 'pending'`) and zombie detection (`WHERE status = 'processing'`)
- [x] `applications` status CHECK includes all 12 statuses from MP §7
- [x] `job_postings` source CHECK includes all 10 sources from MP §7
- [x] `UNIQUE(source, external_id)` on `job_postings`
- [x] `UNIQUE(profile_id, job_posting_id)` on `job_evaluations` and `applications`
- [x] Migration applies cleanly on top of E2-01 migration

---

## E2-03 — Subscriptions, Notifications, Functions & Triggers

**Type:** Schema
**Depends on:** E2-02
**Masterplan:** MP §7 (Subscriptions, Notifications, Database Functions)

### Description

Create the remaining tables (subscriptions, notifications) and all database functions and triggers that automate state management.

### Implementation Notes

- Create `subscriptions` and `notifications` tables per MP §7.
- Create all functions and triggers from MP §7 Database Functions section:
  - `handle_updated_at()` + triggers on all tables with `updated_at`
  - `handle_new_user()` — auto-creates profile + subscription on signup
  - `handle_application_approved()` — increments `applications_used`
  - `claim_pipeline_job()` — atomic job claim with `SKIP LOCKED` + zombie reclaim
  - `fail_pipeline_job(p_job_id, p_error)` — exponential backoff retry
  - `handle_application_status_change()` — logs to `application_events`
- Include the `tracked_boards` updated_at trigger.

### Acceptance Criteria

- [x] `subscriptions` and `notifications` tables created with all columns and constraints
- [x] `handle_updated_at()` trigger fires on UPDATE for all 10 specified tables
- [x] Creating a user in `auth.users` auto-creates a `profiles` row and a `subscriptions` row (plan='free', limit=5)
- [x] Updating an application to status='approved' increments `subscriptions.applications_used` by 1
- [x] `claim_pipeline_job()` returns a single pending job with status changed to 'processing' and attempts incremented
- [x] `claim_pipeline_job()` reclaims zombie jobs (processing for > 5 minutes) before claiming
- [x] `claim_pipeline_job()` returns no rows when queue is empty
- [x] Two concurrent calls to `claim_pipeline_job()` never return the same job (test with two simultaneous queries)
- [x] `fail_pipeline_job()` sets status to 'pending' with exponential `next_retry_at` when attempts < max_attempts
- [x] `fail_pipeline_job()` sets status to 'failed' when attempts >= max_attempts
- [x] Changing application status logs an event to `application_events`

---

## E2-04 — Auth Screens

**Type:** Frontend
**Depends on:** E2-03
**Masterplan:** MP §3 Flow 1 (steps 1-2), MP §9 Screens 2-4, MP §10 Design System

### Description

Build the sign up, sign in, and forgot password screens using Supabase Auth.

### Implementation Notes

- These screens live in the `(auth)` route group — no sidebar, centered card layout.
- Use Supabase Auth client library methods: `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`.
- Sign up form: full name, email, password, confirm password. Pass `full_name` in `options.data` so the `handle_new_user` trigger can access it.
- After sign up, redirect to email verification notice. After verification, redirect to `/onboarding/basics`.
- After sign in, redirect to `/dashboard` (or `/onboarding/basics` if `onboarding_complete` is false).
- Apply design system: Inter font, `--primary` (#1e3a5f), `--surface` (#ffffff), centered card, `--radius-md` (8px).
- Use shadcn/ui `Card`, `Input`, `Button`, `Label` components.
- Show form validation errors inline. Show auth errors (wrong password, email taken) as a toast or alert.

### Acceptance Criteria

- [x] `/signup` renders a centered card with: full name, email, password, confirm password fields and "Create Account" button
- [x] Submitting the sign-up form creates a user in Supabase Auth with `full_name` in user metadata
- [x] After sign-up, a profile row and subscription row exist in the database
- [x] `/signin` renders a centered card with email and password fields and "Sign In" button
- [x] Signing in with valid credentials redirects to `/dashboard`
- [x] Signing in when `onboarding_complete` is false redirects to `/onboarding/basics`
- [x] `/forgot-password` sends a password reset email and shows a confirmation message
- [x] Invalid credentials show an error message (not a crash)
- [x] All three screens use the design system colors, typography, and spacing from MP §10
- [x] Links between the three auth screens work: Sign Up ↔ Sign In, Sign In → Forgot Password

---

## E2-05 — App Shell & Navigation

**Type:** Frontend
**Depends on:** E2-04
**Masterplan:** MP §9 Screen 13 (Sidebar), MP §10 Design System (Sidebar Navigation)

### Description

Build the authenticated app shell with persistent sidebar navigation. Every authenticated page after onboarding uses this layout.

### Implementation Notes

- The app shell is the layout for the `(app)` route group.
- Sidebar: 240px wide, `--surface-alt` background, `--border` right border.
- Sidebar items: Dashboard, Job Feed, Review Queue, Tracker, Add Job, Settings (expandable: Profile, Preferences, Subscription, Account).
- Active item: `--primary` background with white text. Hover: `--surface` background.
- Collapsed mode on screens < 1280px (icon only, 64px wide). Bottom nav on mobile (< 768px).
- Use Lucide icons for nav items (matching shadcn/ui's icon library).
- Include a user menu at the bottom of the sidebar: user email/name, sign out button.
- Protect the `(app)` route group: redirect to `/signin` if no session. Use the server-side Supabase client to check auth in the layout.

### Acceptance Criteria

- [x] `(app)` layout renders a 240px sidebar on the left with main content on the right
- [x] Sidebar contains all nav items: Dashboard, Job Feed, Review Queue, Tracker, Add Job, Settings (with sub-items)
- [x] Active route is highlighted with `--primary` background and white text
- [x] Clicking a nav item navigates to the correct route
- [x] Sidebar collapses to 64px (icons only) between 768px and 1280px viewport width
- [x] Below 768px, sidebar becomes a bottom navigation bar
- [x] Unauthenticated users accessing any `(app)` route are redirected to `/signin`
- [x] Sign out button calls `supabase.auth.signOut()` and redirects to `/signin`
- [x] Sidebar uses Inter font, correct colors, spacing from MP §10

---

# E3 — AI Pipeline Infrastructure

## E3-01 — Anthropic SDK, Langfuse & Sentry Setup

**Type:** Setup
**Depends on:** E2-05
**Masterplan:** MP §5 Agent Execution Environment, MP §6 Stack (Langfuse, Sentry), MP §6 LLM Observability

### Description

Set up the Anthropic TypeScript SDK, Langfuse observability, and Sentry error tracking in Supabase Edge Functions.

### Implementation Notes

- Create a base Edge Function structure in `supabase/functions/`.
- Install `@anthropic-ai/sdk` for Edge Functions (Deno-compatible).
- Create `supabase/functions/_shared/anthropic.ts` — initializes the Anthropic client from `ANTHROPIC_API_KEY`.
- Create `supabase/functions/_shared/langfuse.ts` — initializes Langfuse client. Export a `callAgent()` wrapper function per MP §6 (wraps every LLM call with trace, captures duration, tokens, model, cache stats, success/failure).
- Create `supabase/functions/_shared/sentry.ts` — initializes Sentry with `SENTRY_DSN`. Export an error handler.
- Create `supabase/functions/_shared/supabase.ts` — creates an admin Supabase client using service role key.
- Deploy a test Edge Function that calls Claude Haiku with a simple prompt and returns the response. Verify Langfuse receives the trace.

### Acceptance Criteria

- [x] `supabase/functions/_shared/anthropic.ts` exports a configured Anthropic client
- [x] `supabase/functions/_shared/langfuse.ts` exports a `callAgent(agentType, input, userId)` function that wraps LLM calls with Langfuse tracing
- [x] The `callAgent` wrapper records: agent type, duration_ms, input_tokens, output_tokens, model, cache_read_tokens, success boolean
- [x] `supabase/functions/_shared/sentry.ts` exports an error capture function
- [x] `supabase/functions/_shared/supabase.ts` exports an admin Supabase client
- [x] A test Edge Function successfully calls Claude Haiku and returns a valid response
- [x] The test call appears in Langfuse with all metadata fields populated
- [x] Edge Functions use Deno runtime (no Node.js-only dependencies)

---

## E3-02 — Zod Validation Schemas

**Type:** Backend
**Depends on:** E3-01
**Masterplan:** MP §5 Agent Design Principles (Zod validation), MP §5 Agent Output Schemas

### Description

Define Zod schemas for every AI agent output. These schemas validate all LLM responses before they reach the database.

### Implementation Notes

- Create `src/lib/validators/` with one file per agent:
  - `evaluation.ts` — `EvaluationSchema` (overall_score, dimension scores, recommendation enum, reasoning, strengths, gaps)
  - `pre-screen.ts` — `PreScreenSchema` (pass: boolean, reason: string, disqualifiers: string[])
  - `tailored-resume.ts` — `TailoredResumeSchema` (header, summary, work_experience with source_ids, skills, education, projects, certifications, tailoring_notes, content_markdown)
  - `materials.ts` — `MaterialsSchema` (cover_letter, why_interested, application_answers array)
  - `discovery.ts` — `DiscoveryPostingSchema` (array of postings matching Discovery Agent output schema from MP §5)
  - `job-parsing.ts` — `JobParsingSchema` (for parse-job-url output)
- Also create these as Deno-compatible exports in `supabase/functions/_shared/validators/` (Edge Functions use Deno, so they need Deno-compatible imports).
- Each schema file exports: the Zod schema, the inferred TypeScript type, and a `validate(data)` function that calls `safeParse` and throws a descriptive `ValidationError` on failure.

### Acceptance Criteria

- [x] `EvaluationSchema` validates: all 6 scores are integers 0-100, recommendation is one of the 5 enum values, reasoning is a string of at least 50 characters, strengths and gaps are string arrays
- [x] `PreScreenSchema` validates: pass is boolean, reason is string, disqualifiers is string array
- [x] `TailoredResumeSchema` validates: every work_experience item has a `source_id` UUID, header has required fields, content_markdown is present
- [x] `MaterialsSchema` validates: cover_letter is a non-empty string, why_interested is a non-empty string, application_answers is an array with question/answer/source fields
- [x] `DiscoveryPostingSchema` validates: each posting has external_id, source (enum), source_url, company_name, job_title, description_raw
- [x] All schemas export both a Zod schema object and a TypeScript type
- [x] Each `validate()` function returns the parsed data on success and throws `ValidationError` with a descriptive message on failure
- [x] Schemas are importable from both Next.js (`src/lib/validators/`) and Edge Functions (`supabase/functions/_shared/validators/`)

---

## E3-03 — Pipeline Queue System

**Type:** Backend
**Depends on:** E3-02
**Masterplan:** MP §5 Orchestrator (Queue-Backed Worker Pattern), MP §7 Pipeline Jobs table, MP §8 Edge Functions (process-pipeline)

### Description

Build the `process-pipeline` Edge Function — the worker that claims and processes pipeline jobs in a loop.

### Implementation Notes

- Create `supabase/functions/process-pipeline/index.ts`.
- The worker runs a loop:
  1. Call `claim_pipeline_job()` (the Postgres function from E2-03).
  2. If no job returned, exit.
  3. Based on `job.step`, dispatch to the appropriate handler function (handlers will be implemented in E5-E7, use stubs for now).
  4. On success: mark completed, enqueue next step.
  5. On failure: call `fail_pipeline_job()`.
  6. Check elapsed time — break if > 120 seconds.
- Create step handler stubs that log "Not yet implemented" and mark the job as completed.
- Create a helper function `enqueueNextStep(currentJob, nextStep, extraData)` that inserts a new `pipeline_jobs` row.
- Create a helper `completeJob(jobId)` that sets status='completed' and completed_at=now().
- Set up pg_cron to call this function every 30 seconds (add to a migration file, or document the SQL for manual setup).

### Acceptance Criteria

- [x] `process-pipeline` Edge Function starts, calls `claim_pipeline_job()`, and exits cleanly when no jobs are pending
- [x] When a pipeline job with `step='evaluate'` exists, the worker claims it, calls the stub handler, and marks it completed
- [x] `enqueueNextStep()` correctly inserts a new pipeline_jobs row with the specified step, profile_id, and job_posting_id
- [x] The worker loop processes multiple jobs per invocation (not just one)
- [x] The worker loop exits after 120 seconds of elapsed time
- [x] On handler error, `fail_pipeline_job()` is called and the job gets exponential backoff `next_retry_at`
- [x] A job that has failed 3 times is marked as `status='failed'` and not retried
- [x] pg_cron SQL is documented/created to invoke the function every 30 seconds
- [x] The worker logs each step it processes (step, job_id, profile_id, duration)

---

## E3-04 — Prompt Caching & Agent Call Pattern

**Type:** Backend
**Depends on:** E3-03
**Masterplan:** MP §5 Cost Management (Prompt Caching), MP §6 LLM Observability (callAgent wrapper)

### Description

Implement the standard agent call pattern with Anthropic prompt caching and Langfuse observability that all agents will use.

### Implementation Notes

- Create `supabase/functions/_shared/agent-call.ts` that exports a `callClaude(options)` function:
  ```typescript
  interface AgentCallOptions {
    agentType: string;
    userId: string;
    model: 'claude-sonnet-4-6' | 'claude-haiku-4-5';
    systemPrompt: string;
    cacheableContext?: string;  // User profile, cached via cache_control
    userMessage: string;
    maxTokens: number;
  }
  ```
- When `cacheableContext` is provided, structure the system message as an array with `cache_control: { type: 'ephemeral' }` on both the system prompt and the cacheable context blocks (per MP §5 prompt caching code example).
- Wrap the call with the Langfuse `callAgent` wrapper from E3-01.
- Parse the response text as JSON. Validate is the caller's responsibility (they pass the output through their Zod schema).
- Handle Anthropic API errors: rate limits (429) → throw retryable error. Server errors (500, 529) → throw retryable error. Validation errors (400) → throw non-retryable error.
- Create a test that calls `callClaude` with Haiku and verifies the response is parseable JSON and the Langfuse trace is recorded with cache stats.

### Acceptance Criteria

- [x] `callClaude()` successfully calls Claude Sonnet and Haiku models
- [x] When `cacheableContext` is provided, the request uses `cache_control: { type: 'ephemeral' }` on system message blocks
- [x] Every call is wrapped with Langfuse tracing (agent type, user ID, tokens, duration, cache stats)
- [x] Rate limit errors (429) are thrown as retryable errors (the pipeline worker will retry with backoff)
- [x] Server errors (500, 529) are thrown as retryable errors
- [x] Bad request errors (400) are thrown as non-retryable errors
- [x] The response content text is returned as a string (caller parses and validates)
- [x] A test call with Haiku returns valid JSON and appears in Langfuse

---

# E4 — Onboarding

## E4-01 — Onboarding Wizard

**Type:** Frontend
**Depends on:** E3-04
**Masterplan:** MP §3 Flow 1, MP §9 Screens 5-12, MP §10 Design System

### Description

Build the 8-step onboarding wizard that guides new users through profile creation. This is the first thing every user experiences after sign-up. Resume upload is offered as Step 1 (optional) — if provided, parsed data pre-fills all subsequent steps so users can review and edit rather than type from scratch.

### Implementation Notes

- Onboarding routes live in `(app)/onboarding/` with a dedicated layout (no sidebar — progress bar at top, back/continue buttons at bottom).
- Steps: upload → basics → headline → experience → education → skills → projects → preferences.
- Each step is a separate route: `/onboarding/upload`, `/onboarding/basics`, `/onboarding/headline`, etc.
- Progress bar shows 8 steps with current step highlighted.
- Step 1 (Resume Upload): two-option choice card — "Upload your resume" (drag-and-drop zone, accepts PDF/DOCX up to 5MB) or "Start from scratch" (skip button). After upload, show a parsing progress indicator, then a summary of what was extracted. Parsed data is stored in a `resume_parsed_data` JSONB column on `profiles` for use by subsequent steps. Parsing itself is implemented in E4-02 — this step provides the upload UI and file storage only. If parsing is not yet available, the file is saved to Supabase Storage and the user proceeds with empty steps.
- Steps 2-7: If `resume_parsed_data` exists on the profile, pre-fill form fields from the parsed data. Show an "Imported from resume" badge on pre-filled entries. All pre-filled fields are fully editable.
- All data saves to the database via Server Actions on "Continue" — progress is preserved if user abandons.
- Step 4 (Work Experience): expandable cards with achievement bullets. "Add Experience" button. Each entry includes country field.
- Step 6 (Skills): tag-style input with category and proficiency dropdowns per skill.
- Step 2 (Basic Info): includes country dropdown and location (city/region) field.
- Step 8 (Preferences): match threshold slider (0-100) with labels at 50/70/90. Target countries (multi-select), target role titles, locations (multi-select/free text), remote preference, salary range with currency selector (default based on user's country), job types, excluded companies/keywords, preferred industries/company sizes.
- On final step completion, set `profiles.onboarding_complete = true` and redirect to `/dashboard`.
- Create Server Actions for all profile CRUD: `createWorkExperience`, `updateWorkExperience`, `deleteWorkExperience`, `reorderWorkExperiences`, `createAchievement`, `updateAchievement`, `deleteAchievement`, plus CRUD for education, skills, projects, certifications, search preferences.

### Acceptance Criteria

- [ ] 8 onboarding steps render at their respective routes with a progress bar showing current step
- [ ] Step 1 (Resume Upload): shows upload option and "Start from scratch" skip button; file input accepts PDF and DOCX files up to 5MB; uploaded file is saved to Supabase Storage
- [ ] Step 2 (Basic Info): saves full_name, phone, country, location, linkedin_url, portfolio_url, github_url to profiles table; pre-fills from parsed resume data if available
- [ ] Step 3 (Headline): saves headline and summary to profiles table; pre-fills from parsed resume data if available
- [ ] Step 4 (Work Experience): user can add multiple entries with achievements, save to work_experiences + achievements tables; pre-fills from parsed resume data if available
- [ ] Step 5 (Education): saves to education table; pre-fills from parsed resume data if available
- [ ] Step 6 (Skills): saves to skills table with category and proficiency; pre-fills from parsed resume data if available
- [ ] Step 7 (Projects & Certs): saves to projects and certifications tables; pre-fills from parsed resume data if available
- [ ] Step 8 (Preferences): saves to search_preferences table (including target_countries, salary_currency, next_discovery_at)
- [ ] "Back" button navigates to the previous step; "Continue" saves current data and advances
- [ ] Abandoning mid-onboarding preserves all entered data — returning later resumes from last step
- [ ] Completing step 8 sets `onboarding_complete = true` and redirects to `/dashboard`
- [ ] All Server Actions validate input server-side and return appropriate errors
- [ ] Pre-filled fields from resume parsing are fully editable before saving

---

## E4-02 — AI Assist & Resume Parsing

**Type:** Integration
**Depends on:** E4-01
**Masterplan:** MP §3 Flow 1 (AI assist, resume parsing), MP §5 Model Routing (skill suggestion, achievement improvement), MP §8 AI Assist Server Actions

### Description

Add AI-powered features to the onboarding flow: resume parsing for Step 1 pre-fill, professional summary generation, skill suggestions from work history, and achievement bullet improvement.

### Implementation Notes

- **Resume Parsing (Step 1):** Create a `parse-resume` Edge Function that accepts a Supabase Storage file path, reads the file content, and calls Claude Haiku for structured extraction. Output includes: full_name, phone, location, country, linkedin_url, headline, summary, work_experiences (with achievements), education, skills (with inferred categories and proficiency), projects, certifications. Parsed data is validated against a `ResumeParsingSchema` (Zod) and saved to `profiles.resume_parsed_data` (JSONB). The upload step (E4-01) calls this Edge Function after file upload and shows a summary of extracted data. Subsequent onboarding steps read from `resume_parsed_data` to pre-fill forms.
- Three AI assist Server Actions (MP §8):
  - `generateSummary()` — calls Claude Sonnet with user's work history, generates a 2-3 sentence professional summary. Returns suggestion (does not auto-save).
  - `suggestSkills()` — calls Claude Haiku, analyzes work history entries and achievements, returns a list of suggested skills with categories and proficiency levels.
  - `improveAchievement(achievementId)` — calls Claude Sonnet, rewrites a single achievement bullet for impact and clarity. Returns suggestion (does not auto-save).
- Each AI call uses the `callClaude` pattern from E3-04 with Langfuse tracing.
- UI: sparkle icon buttons next to the relevant fields. Clicking shows a loading state, then displays the suggestion with "Accept" / "Dismiss" options.

### Acceptance Criteria

- [ ] Resume upload on Step 1 triggers parsing via `parse-resume` Edge Function
- [ ] Parsed data is saved to `profiles.resume_parsed_data` as structured JSON
- [ ] Steps 2-7 pre-fill form fields from `resume_parsed_data` when it exists
- [ ] Parsing summary shows count of extracted items (e.g., "Found: 3 work experiences, 2 education entries, 12 skills")
- [ ] Parsing failure shows a user-friendly message and allows the user to proceed with manual entry
- [ ] "Help me write this" button on Step 3 generates a professional summary from existing profile data
- [ ] "Suggest skills" button on Step 6 returns skills extracted from work history with category and proficiency
- [ ] "Improve this bullet" button on Step 4 achievement entries returns an improved version
- [ ] All AI features show a loading spinner while processing
- [ ] AI suggestions are displayed as proposals — user must click "Accept" to save them
- [ ] All AI calls appear in Langfuse with correct agent type labels
- [ ] AI errors show a user-friendly message (not a crash)

---

# E5 — Job Discovery

## E5-01 — Discovery Agent (Aggregator APIs)

**Type:** Backend
**Depends on:** E4-02
**Masterplan:** MP §5 Discovery Agent Detail, MP §5 Model Routing (Job description parsing → Haiku)

### Description

Build the Discovery Agent that fetches and normalizes job postings from aggregator APIs (SerpAPI Google Jobs, JSearch).

### Implementation Notes

- Create `supabase/functions/_shared/agents/discovery.ts`.
- Two source functions:
  - `searchGoogleJobs(query, location, country, radius)` — calls SerpAPI's Google Jobs endpoint. Normalize results into the `DiscoveryPostingSchema` format.
  - `searchJSearch(query, location, country, jobType)` — calls JSearch API on RapidAPI. Normalize results.
- For each raw posting, call Claude Haiku to extract structured fields (skills, experience level, salary if present) from the description text. Use `callClaude` with `model: 'claude-haiku-4-5'`.
- Validate each posting against `DiscoveryPostingSchema`.
- Deduplication: before saving, check `job_postings` for existing entries with same `(source, external_id)`. Skip duplicates. Also check for cross-source duplicates by matching company_name + job_title + location similarity.
- Save new postings to `job_postings` table.

### Acceptance Criteria

- [ ] `searchGoogleJobs()` calls SerpAPI and returns normalized postings matching `DiscoveryPostingSchema`
- [ ] `searchJSearch()` calls JSearch API and returns normalized postings matching `DiscoveryPostingSchema`
- [ ] Each posting has structured fields extracted by Haiku: required_skills, preferred_skills, experience_level, salary range
- [ ] All postings pass `DiscoveryPostingSchema` validation
- [ ] Duplicate postings (same source + external_id) are skipped
- [ ] Cross-source duplicates (same company + title + location) are detected and skipped
- [ ] New postings are saved to `job_postings` with correct source, status='active', and discovered_at
- [ ] API errors (rate limits, timeouts) are caught and logged, not thrown (partial results are saved)
- [ ] All Haiku parsing calls appear in Langfuse

---

## E5-02 — ATS Board Monitoring & Tracked Boards

**Type:** Integration
**Depends on:** E5-01
**Masterplan:** MP §5 Discovery Agent (Greenhouse, Lever tools), MP §7 Tracked Boards, MP §8 Tracked Boards Server Actions

### Description

Add Greenhouse and Lever board monitoring to the Discovery Agent, and build the tracked boards CRUD interface.

### Implementation Notes

- Two additional source functions in the discovery agent:
  - `scrapeGreenhouseBoard(boardUrl)` — Greenhouse boards expose JSON at `{boardUrl}/departments`. Parse and normalize.
  - `scrapeLeverBoard(boardUrl)` — Lever boards expose JSON at `{boardUrl}?mode=json`. Parse and normalize.
- These functions are called for each active entry in the user's `tracked_boards` table.
- Update `last_checked_at` after checking each board.
- Server Actions for tracked boards (MP §8): `createTrackedBoard`, `deleteTrackedBoard`, `getTrackedBoards`.
- The tracked boards UI will be added in E13-01 (Settings), but the server actions and backend need to exist now.

### Acceptance Criteria

- [ ] `scrapeGreenhouseBoard()` fetches and parses a Greenhouse job board JSON, returning normalized postings
- [ ] `scrapeLeverBoard()` fetches and parses a Lever job board JSON, returning normalized postings
- [ ] Board results are filtered by the user's search keywords before saving
- [ ] `tracked_boards.last_checked_at` is updated after each check
- [ ] `createTrackedBoard` Server Action validates URL format and saves to database
- [ ] `deleteTrackedBoard` Server Action removes the board entry
- [ ] `getTrackedBoards` returns all boards for the authenticated user
- [ ] Board fetch errors (404, timeout) are caught and logged, not thrown

---

## E5-03 — Discovery Edge Functions & Cron Scheduling

**Type:** Integration
**Depends on:** E5-02
**Masterplan:** MP §5 Orchestrator, MP §8 Edge Functions (trigger-discoveries, discover-jobs), MP §8 pg_cron configuration

### Description

Build the `discover-jobs` and `trigger-discoveries` Edge Functions and configure pg_cron scheduling.

### Implementation Notes

- `supabase/functions/discover-jobs/index.ts`:
  - Input: `{ "profile_id": "uuid" }`
  - Creates a `discovery_runs` record with status='running'.
  - Reads user's `search_preferences` and `tracked_boards`.
  - Calls all discovery sources in parallel (Promise.allSettled): Google Jobs, JSearch, each tracked Greenhouse board, each tracked Lever board.
  - Deduplicates all results against existing `job_postings`.
  - Saves new postings.
  - For each new posting, inserts a `pipeline_jobs` row with `step='pre_screen'`, status='pending'.
  - Updates `discovery_runs` with counts (jobs_found, jobs_new) and status='completed'.
  - Updates `search_preferences.next_discovery_at` based on subscription tier (free=+12h, pro=+6h, premium=+1h).
- `supabase/functions/trigger-discoveries/index.ts`:
  - Input: none.
  - Queries all users where `search_preferences.is_active = true AND next_discovery_at <= now()`.
  - For each user, calls `discover-jobs` Edge Function (or calls the discovery logic directly).
  - Runs as a loop to handle multiple users.
- Document pg_cron SQL for both functions (process-pipeline every 30s, trigger-discoveries every hour).

### Acceptance Criteria

- [ ] `discover-jobs` creates a `discovery_runs` record, runs discovery, and updates it with final counts
- [ ] `discover-jobs` enqueues `pipeline_jobs` with `step='pre_screen'` for each new posting discovered
- [ ] `discover-jobs` updates `next_discovery_at` based on subscription tier after completion
- [ ] `discover-jobs` handles partial failures — if one source fails, others still complete
- [ ] `trigger-discoveries` finds users due for discovery and triggers `discover-jobs` for each
- [ ] `trigger-discoveries` only triggers for users where `is_active = true` and `next_discovery_at <= now()`
- [ ] pg_cron SQL is provided for: `process-pipeline` every 30 seconds, `trigger-discoveries` every hour
- [ ] End-to-end test: trigger discovery for a test user → new job postings appear in database → pipeline_jobs enqueued

---

# E6 — Job Evaluation

## E6-01 — Haiku Pre-Screen Agent

**Type:** Backend
**Depends on:** E5-03
**Masterplan:** MP §3 Flow 3 (Stage 1), MP §5 Two-Stage Evaluation, MP §5 Model Routing (pre-screen → Haiku)

### Description

Build the Haiku pre-screen that quickly filters out obvious mismatches before the expensive Sonnet evaluation.

### Implementation Notes

- Create `supabase/functions/_shared/agents/pre-screen.ts`.
- The pre-screen checks: title mismatch, country/location incompatibility, seniority mismatch, salary range mismatch.
- System prompt provides: user's target roles, target countries, target locations, remote preference, experience years, salary range.
- User message provides: job title, country, location, is_remote, experience_level, salary range.
- Uses `callClaude` with `model: 'claude-haiku-4-5'`.
- Output validated against `PreScreenSchema`.
- Wire into `process-pipeline` worker: when `step='pre_screen'`:
  - If `pass = true`: enqueue `step='evaluate'`.
  - If `pass = false`: mark pipeline job as completed. **Do not** create a job_evaluations record. Store the pre-screen result in `pipeline_jobs.output_data`.

### Acceptance Criteria

- [ ] Pre-screen agent calls Haiku with user preferences and job posting summary
- [ ] Output is validated against `PreScreenSchema`
- [ ] A clearly mismatched job (e.g., "CEO" for a junior developer) returns `pass: false` with disqualifiers
- [ ] A reasonable match returns `pass: true`
- [ ] When `pass = false`, the pipeline job is marked completed with output_data containing the pre-screen result
- [ ] When `pass = false`, NO evaluation record is created in `job_evaluations`
- [ ] When `pass = true`, a new pipeline job with `step='evaluate'` is enqueued
- [ ] Pre-screen calls appear in Langfuse with agent type "pre_screen"
- [ ] Average pre-screen cost is under $0.002 per call

---

## E6-02 — Sonnet Full Evaluation Agent

**Type:** Backend
**Depends on:** E6-01
**Masterplan:** MP §3 Flow 3 (Stage 2), MP §5 Evaluation Agent Detail, MP §5 Scoring Rubric

### Description

Build the full evaluation agent that scores jobs against user profiles on five dimensions using Claude Sonnet.

### Implementation Notes

- Create `supabase/functions/_shared/agents/evaluation.ts`.
- System prompt includes: scoring rubric with weights (skill 30%, experience 25%, seniority 15%, location 15%, technology 15%), dimension definitions from MP §5.
- Use `callClaude` with `model: 'claude-sonnet-4-6'` and prompt caching: the user's full profile is the `cacheableContext` parameter (cached across all evaluations in a run).
- Output validated against `EvaluationSchema`.
- Wire into `process-pipeline`: when `step='evaluate'`:
  - Save evaluation to `job_evaluations`.
  - If `passes_threshold` (score >= user's `match_threshold`): create an `applications` record with status='draft', enqueue `step='tailor'`.
  - If below threshold: save evaluation only. No application created.

### Acceptance Criteria

- [ ] Evaluation agent calls Sonnet with the full job posting and user profile
- [ ] User profile is sent using prompt caching (`cache_control: { type: 'ephemeral' }`)
- [ ] Output includes all 6 dimension scores (0-100), overall score, recommendation, reasoning, strengths, gaps
- [ ] Output is validated against `EvaluationSchema`
- [ ] Evaluation is saved to `job_evaluations` with correct profile_id and job_posting_id
- [ ] When score >= match_threshold: an application record is created with status='draft' and a `step='tailor'` pipeline job is enqueued
- [ ] When score < match_threshold: evaluation is saved with `passes_threshold = false`, no application or tailoring job created
- [ ] Prompt caching is working: second evaluation in same run shows `cache_read_input_tokens > 0` in Langfuse
- [ ] Evaluation calls appear in Langfuse with agent type "evaluation"

---

## E6-03 — Manual Job Addition

**Type:** Integration
**Depends on:** E6-02
**Masterplan:** MP §3 Flow 7, MP §8 POST /api/jobs/manual, MP §8 parse-job-url Edge Function, MP §9 Screen 21

### Description

Build the manual job addition flow: user pastes a URL or description, system parses it and sends it through the pipeline.

### Implementation Notes

- Create `supabase/functions/parse-job-url/index.ts`:
  - Fetches the URL content (handle JavaScript-rendered pages with basic fetch — if it fails, user falls back to manual paste).
  - Calls Haiku to extract structured job data from the HTML/text.
  - Returns structured data matching `JobParsingSchema`.
- Create the Add Job screen at `(app)/jobs/add`:
  - Two tabs: "Paste URL" and "Manual Entry".
  - Paste URL: input field + "Fetch & Parse" button → shows parsing progress → displays extracted data for review → "Save & Evaluate" button.
  - Manual Entry: full form (title, company, country, location, remote, job_type, experience_level, description, application_url) → "Save & Evaluate" button.
- On save: create `job_postings` record with source='manual', enqueue `pipeline_jobs` with `step='pre_screen'`.
- Create the API route `POST /api/jobs/manual` per MP §8.

### Acceptance Criteria

- [ ] `parse-job-url` Edge Function fetches a URL and returns structured job data
- [ ] Parsed data includes: job_title, company_name, location, description_raw, application_url, required_skills
- [ ] `/jobs/add` renders two tabs: "Paste URL" and "Manual Entry"
- [ ] Pasting a URL and clicking "Fetch & Parse" shows a loading state, then displays extracted data
- [ ] User can review and edit extracted data before saving
- [ ] Manual entry form has all required fields with validation
- [ ] Saving creates a `job_postings` record with source='manual'
- [ ] Saving enqueues a `pipeline_jobs` row with `step='pre_screen'`
- [ ] URL behind a login wall shows an error message prompting user to use Manual Entry
- [ ] The pipeline_status is returned in the response so the UI can show "evaluating..."

---

# E7 — Resume Tailoring & Materials

## E7-01 — Tailoring Agent

**Type:** Backend
**Depends on:** E6-03
**Masterplan:** MP §5 Tailoring Agent Detail, MP §3 Flow 4

### Description

Build the Tailoring Agent that generates a customized resume from the knowledge base for a specific job posting.

### Implementation Notes

- Create `supabase/functions/_shared/agents/tailoring.ts`.
- System prompt includes: the hard truthfulness constraint from MP §5, permitted and forbidden operations.
- Input: job posting, evaluation (strengths, gaps), user's complete knowledge base (all work experience with achievements, skills, education, projects, certifications).
- Use `callClaude` with `model: 'claude-sonnet-4-6'` and prompt caching (knowledge base as cacheable context).
- Output validated against `TailoredResumeSchema`.
- Post-validation: verify every `source_id` in the output actually exists in the user's knowledge base. If any source_id is invalid, treat as a validation failure.
- Wire into `process-pipeline`: when `step='tailor'`:
  - Save to `resume_versions` (content_json, content_markdown, tailoring_notes, profile_id, application_id, job_posting_id).
  - Enqueue `step='generate_materials'`.

### Acceptance Criteria

- [ ] Tailoring agent calls Sonnet with job posting, evaluation, and full knowledge base
- [ ] Output is validated against `TailoredResumeSchema`
- [ ] Every `source_id` in the output references a real entry in the user's knowledge base
- [ ] Invalid `source_id` values cause a validation failure (pipeline retries)
- [ ] Resume includes: header, summary, reordered work experience, selected skills, education, projects
- [ ] Output does not include companies, achievements, or skills not present in the knowledge base
- [ ] Resume version is saved to `resume_versions` with content_json, content_markdown, and tailoring_notes
- [ ] Pipeline enqueues `step='generate_materials'` on success
- [ ] Knowledge base is sent using prompt caching
- [ ] Tailoring calls appear in Langfuse with agent type "tailoring"

---

## E7-02 — Materials Agent (Cover Letter + Application Answers)

**Type:** Backend
**Depends on:** E7-01
**Masterplan:** MP §5 Materials Agent Detail, MP §5 Model Routing (Sonnet for cover letter, Haiku for extraction answers)

### Description

Build the Materials Agent that generates a cover letter, "why interested" answer (via Sonnet), and extraction-based application answers (via Haiku).

### Implementation Notes

- Create `supabase/functions/_shared/agents/materials.ts`.
- Two LLM calls per invocation:
  1. **Sonnet call**: generates cover_letter + why_interested. Input: job posting, evaluation, tailored resume. Cover letter rules from MP §5 (3-4 paragraphs, specific to company, references job posting details).
  2. **Haiku call**: generates application_answers (years of experience, work authorization, salary, relocation, proficiency, start date). Input: user profile data.
- Combine outputs and validate against `MaterialsSchema`.
- Wire into `process-pipeline`: when `step='generate_materials'`:
  - Update the `applications` record: set cover_letter, application_answers (JSONB).
  - Enqueue `step='generate_files'`.

### Acceptance Criteria

- [ ] Materials agent makes two LLM calls: Sonnet (cover letter + why interested) and Haiku (extraction answers)
- [ ] Cover letter is 3-4 paragraphs, references specific details from the job posting
- [ ] "Why interested" answer draws from evaluation strengths and job posting specifics
- [ ] Extraction answers include: years of experience, work authorization, salary expectations, relocation willingness, start date
- [ ] All outputs validated against `MaterialsSchema`
- [ ] Application record is updated with cover_letter and application_answers JSONB
- [ ] Pipeline enqueues `step='generate_files'` on success
- [ ] Both calls appear in Langfuse with agent types "materials_sonnet" and "materials_haiku"

---

## E7-03 — End-to-End Pipeline Integration Test

**Type:** Integration
**Depends on:** E7-02
**Masterplan:** MP §5 Orchestrator (full pipeline flow)

### Description

Verify the complete pipeline works end-to-end: discovery → pre-screen → evaluate → tailor → materials → file generation (stub). This is a critical integration checkpoint before building the frontend.

### Implementation Notes

- Create a test script or Edge Function that:
  1. Creates a test user with a populated profile (work experience, skills, education).
  2. Triggers `discover-jobs` for the test user.
  3. Waits for pipeline jobs to be processed by `process-pipeline`.
  4. Verifies the chain: pipeline_jobs records progress through all steps.
  5. Verifies data integrity: job_postings → job_evaluations → applications → resume_versions all exist with correct foreign keys.
- The `generate_files` step handler should be a stub that sets `application.status = 'ready'` (PDF/DOCX generation is E8-01).
- Fix any integration issues discovered during this test.

### Acceptance Criteria

- [ ] A test user with a complete profile can trigger discovery
- [ ] New job postings are discovered and saved to the database
- [ ] Pipeline jobs are created with `step='pre_screen'` for each new posting
- [ ] The process-pipeline worker processes jobs through: pre_screen → evaluate → tailor → generate_materials → generate_files (stub)
- [ ] Some postings are filtered out at pre_screen (not all pass)
- [ ] Passing postings have evaluations, applications, and resume_versions created
- [ ] Application status progresses from 'draft' → 'ready' (via stub file generation)
- [ ] `pipeline_jobs` table shows completed jobs for each step in the chain
- [ ] Failed pipeline jobs show correct error messages and retry state
- [ ] End-to-end pipeline completes within 5 minutes for 10 discovered postings

---

# E8 — Review Queue & File Generation

## E8-01 — Resume File Generation (PDF + DOCX)

**Type:** Backend
**Depends on:** E7-03
**Masterplan:** MP §6 Stack (docx, @react-pdf/renderer), MP §8 Edge Functions (generate-resume-files)

### Description

Build the Edge Function that generates PDF and DOCX files from a tailored resume's structured JSON.

### Implementation Notes

- Create `supabase/functions/generate-resume-files/index.ts`.
- Read `resume_versions.content_json` for the specified resume version.
- Generate PDF using `@react-pdf/renderer` — create a professional resume template (clean, single-column, ATS-friendly). Use the design system typography values for styling.
- Generate DOCX using the `docx` npm library — matching layout and content.
- Upload both files to Supabase Storage bucket `resumes` with path: `{profile_id}/{resume_version_id}.pdf` and `.docx`.
- Update `resume_versions` with signed URLs: `file_url_pdf`, `file_url_docx`.
- Wire into `process-pipeline`: when `step='generate_files'`, call this function, then set `application.status = 'ready'` and create a notification.
- Replace the stub handler from E7-03.

### Acceptance Criteria

- [ ] Edge Function reads resume content_json and generates a PDF file
- [ ] Edge Function generates a DOCX file with matching content
- [ ] PDF renders a professional, ATS-friendly resume layout (header, summary, experience, skills, education)
- [ ] DOCX has equivalent content and formatting
- [ ] Both files are uploaded to Supabase Storage under `resumes/{profile_id}/`
- [ ] `resume_versions` row is updated with signed download URLs
- [ ] Application status is set to 'ready' after file generation
- [ ] A notification is created for the user ("Your application for [role] at [company] is ready for review")
- [ ] Files are accessible via the signed URLs (not expired)

---

## E8-02 — Review Queue Screen

**Type:** Frontend
**Depends on:** E8-01
**Masterplan:** MP §3 Flow 5, MP §9 Screen 16, MP §10 Design System

### Description

Build the Review Queue screen where users see their prepared applications awaiting approval.

### Implementation Notes

- Route: `(app)/queue/page.tsx`.
- Three tabs: Ready (default), Saved for Later, Skipped. Filter applications by status.
- Each application card shows: company name, job title, match score badge (color-coded), "Prepared X ago" timestamp, tailoring notes preview.
- Action buttons per card: "Review" (navigates to detail), "Quick Approve", "Skip".
- "Quick Approve" triggers the approve flow (E8-04) directly from the queue.
- Empty state: "No applications waiting for review. Woodhouse will prepare new applications as matching jobs are discovered."
- Subscribe to Supabase Realtime on the `applications` table so new ready applications appear without page refresh.
- Sort by match score (highest first).
- Use the `GET /api/applications` endpoint with status filter.

### Acceptance Criteria

- [ ] `/queue` renders a list of applications with status='ready', sorted by match score
- [ ] Each card shows: company name, job title, match score badge, time since prepared, tailoring notes preview
- [ ] Match score badge is color-coded: green (80+), yellow (60-79), red (<60)
- [ ] Three tabs filter by status: Ready, Saved for Later, Skipped
- [ ] "Review" button navigates to `/queue/:id`
- [ ] "Quick Approve" triggers the approve flow and updates the card
- [ ] "Skip" sets application status to 'skipped' and removes from Ready tab
- [ ] Empty state message displays when no applications are in the current tab
- [ ] New applications appearing in the database show up without page refresh (Realtime)
- [ ] Pagination works for users with many queued applications

---

## E8-03 — Application Detail Screen

**Type:** Frontend
**Depends on:** E8-02
**Masterplan:** MP §3 Flow 5, MP §9 Screens 17-18, MP §10 Design System

### Description

Build the application detail screen with tabs for overview, resume, cover letter, answers, and job posting.

### Implementation Notes

- Route: `(app)/queue/[id]/page.tsx`.
- Tabbed interface: Overview, Resume, Cover Letter, Application Answers, Job Posting.
- **Overview tab**: job details + evaluation summary side by side. Action buttons (Approve, Edit & Approve, Skip, Save for Later).
- **Resume tab**: rendered resume preview from content_markdown. Toggle for "Changes from base" diff view (compare tailored vs. base profile). "Edit" button for inline editing.
- **Cover Letter tab**: full text, inline editable. "Regenerate" button (calls Materials Agent again — optional, can be a V2 feature).
- **Application Answers tab**: list of question-answer pairs. Each answer is inline editable. Source note below each.
- **Job Posting tab**: full original job description.
- Use Server Actions for inline edits: `updateApplication({ cover_letter, application_answers })`.
- The diff view compares `resume_versions.content_json` against the user's current profile data.

### Acceptance Criteria

- [ ] `/queue/:id` renders with 5 tabs: Overview, Resume, Cover Letter, Answers, Job Posting
- [ ] Overview tab shows job details and evaluation breakdown (scores, strengths, gaps, recommendation)
- [ ] Resume tab renders the tailored resume as formatted content
- [ ] Resume tab has a "Toggle Diff View" showing changes from base profile (additions highlighted)
- [ ] Cover Letter tab shows the full cover letter text, editable inline
- [ ] Application Answers tab shows all Q&A pairs, each editable inline
- [ ] Job Posting tab shows the full original job description
- [ ] Inline edits save via Server Actions and show a success toast
- [ ] Action buttons (Approve, Skip, Save for Later) are visible on the Overview tab
- [ ] "Back to Queue" link returns to `/queue`

---

## E8-04 — Approve Flow & File Downloads

**Type:** Integration
**Depends on:** E8-03
**Masterplan:** MP §3 Flow 5 (step 4), MP §8 POST /api/applications/:id/approve

### Description

Build the approve flow: check subscription limits, generate final files, open application URL, provide clipboard functionality.

### Implementation Notes

- `POST /api/applications/:id/approve` Server Action:
  1. Check `subscriptions.applications_used < applications_limit`. If exceeded, return error with upgrade prompt.
  2. Set application status to 'approved'.
  3. Trigger `generate-resume-files` Edge Function (or use the already-generated files if they exist).
  4. Return: resume PDF URL, DOCX URL, application URL, cover letter, application answers.
- The `handle_application_approved` trigger increments `applications_used`.
- Frontend approve flow:
  1. Confirmation modal: "Resume files will be generated. The application link will open in a new tab."
  2. On confirm: call approve endpoint, show loading.
  3. On success: open `application_url` in new tab, show download buttons for PDF/DOCX, show "copy to clipboard" buttons next to cover letter and each answer.
  4. Update application status to 'approved' in the UI.
- Add `POST /api/applications/:id/submit` — user clicks "I've submitted" after manually applying. Sets status to 'submitted', logs timestamp.

### Acceptance Criteria

- [ ] Approving an application checks the subscription limit before proceeding
- [ ] If limit exceeded, user sees an upgrade prompt (not an error crash)
- [ ] Successful approval sets application status to 'approved'
- [ ] `subscriptions.applications_used` is incremented by 1
- [ ] Resume PDF and DOCX download URLs are returned and functional
- [ ] Application URL opens in a new browser tab
- [ ] "Copy to clipboard" buttons work for cover letter and each application answer
- [ ] Confirmation modal appears before approval
- [ ] "I've submitted" button sets status to 'submitted' with timestamp
- [ ] Approved application moves from Review Queue to Tracker

---

# E9 — Dashboard & Job Feed

## E9-01 — Dashboard Screen

**Type:** Frontend
**Depends on:** E8-04
**Masterplan:** MP §3 Flows (overview), MP §8 GET /api/dashboard, MP §9 Screen 13

### Description

Build the main dashboard that users see after onboarding. Shows key metrics, recent matches, and activity feed.

### Implementation Notes

- Route: `(app)/dashboard/page.tsx`.
- Create `GET /api/dashboard` Server Action that aggregates:
  - queue_count (applications with status='ready')
  - applications_this_period / applications_limit (from subscriptions)
  - total_submitted (applications with status='submitted')
  - response_rate (applications with response / total submitted)
  - last_discovery_run (completed_at, jobs_found, jobs_matched)
  - recent_matches (5 most recent evaluations passing threshold)
  - recent_activity (latest application_events)
- Four stat cards in top row: Applications Ready, Used This Month (X/Y with progress bar), Submitted, Response Rate.
- Recent Matches: scrollable list of 5 recent matched jobs. Each shows company, title, score badge, time since discovered. Click opens Job Detail.
- Activity Feed: chronological events (new matches, applications prepared, status updates).
- Discovery Status Card: last scan time, next scan time, jobs found/matched in last run.
- Subscribe to Realtime on `applications` and `discovery_runs` for live updates.

### Acceptance Criteria

- [ ] `/dashboard` renders four stat cards: Applications Ready, Used This Month, Submitted, Response Rate
- [ ] "Used This Month" shows a progress bar (X of Y applications used)
- [ ] Recent Matches section shows up to 5 most recent matched jobs with score badges
- [ ] Clicking a recent match navigates to the job detail page
- [ ] Activity Feed shows recent events in chronological order
- [ ] Discovery Status Card shows last scan time and next scheduled scan
- [ ] Dashboard data loads via a Server Action that aggregates from multiple tables
- [ ] Realtime subscription updates the dashboard when new applications become ready
- [ ] Empty states render correctly for new users with no data yet

---

## E9-02 — Job Feed Screen

**Type:** Frontend
**Depends on:** E9-01
**Masterplan:** MP §9 Screen 14, MP §8 GET /api/jobs

### Description

Build the job feed showing all discovered jobs with filters, search, and sorting.

### Implementation Notes

- Route: `(app)/jobs/page.tsx`.
- Filter bar: search input, source dropdown, score range slider, country filter, location filter, remote toggle, status filter (active/expired). "Clear Filters" button.
- Sort dropdown: Match Score (high to low), Newest, Company Name.
- Job card: company name + logo placeholder (40x40), job title, location + remote badge, source badge, match score badge (color-coded), posted date, quick action buttons ("View Details", "Add to Queue" for below-threshold jobs).
- Pagination at bottom.
- Use `GET /api/jobs` with query params for filtering, sorting, pagination.
- The API joins `job_postings` with the user's `job_evaluations` to include scores.

### Acceptance Criteria

- [ ] `/jobs` renders a list of discovered job postings for the authenticated user
- [ ] Each job card shows: company, title, location, remote badge, source badge, match score, posted date
- [ ] Match score badge is color-coded: green 80+, yellow 60-79, red <60, gray if not evaluated
- [ ] Filters work: search by keyword, filter by source, score range, country, location, remote, status
- [ ] "Clear Filters" resets all filters
- [ ] Sort works: by match score, newest, company name
- [ ] Pagination loads next/previous pages
- [ ] "View Details" navigates to `/jobs/:id`
- [ ] "Add to Queue" for below-threshold jobs creates an application and enqueues tailoring
- [ ] Empty state: "No jobs found matching your criteria"

---

## E9-03 — Job Detail Screen

**Type:** Frontend
**Depends on:** E9-02
**Masterplan:** MP §9 Screen 15

### Description

Build the job detail screen showing the full job posting and evaluation breakdown.

### Implementation Notes

- Route: `(app)/jobs/[id]/page.tsx`.
- Two-column layout: left (60%) full job description, right (40%) evaluation card.
- Job description sections: About the Role, Responsibilities, Requirements, Preferred Qualifications, Benefits, Application Link.
- Evaluation card: overall score (large, color-coded), recommendation badge, 5 dimension score bars, strengths list (green checkmarks), gaps list (orange warnings), reasoning paragraph.
- Action button: "Prepare Application" (triggers tailoring pipeline) or "View Application" (if already prepared) or "Below Threshold — Prepare Anyway".
- "Prepare Anyway" for below-threshold jobs: creates application, enqueues pipeline from `step='tailor'` (skips pre-screen and evaluation since evaluation already exists).

### Acceptance Criteria

- [ ] `/jobs/:id` renders two-column layout with job description and evaluation card
- [ ] Job description shows all structured sections from the posting
- [ ] Evaluation card shows overall score, recommendation badge, 5 dimension score bars
- [ ] Score bars are visually proportional (0-100 scale)
- [ ] Strengths show with green checkmarks, gaps with orange warning icons
- [ ] "Prepare Application" button enqueues the tailoring pipeline
- [ ] "View Application" button navigates to `/queue/:applicationId` when application exists
- [ ] "Prepare Anyway" creates an application for below-threshold jobs
- [ ] Loading skeleton shows while data is being fetched

---

## E9-04 — Tailoring Prompt Customization

**Type:** Full-stack (Schema + Backend + Frontend)
**Depends on:** E9-03, E7-01
**Masterplan:** MP §5 Tailoring Agent

### Description

Add admin-controlled tailoring prompt customization with three modes: System Default (hardcoded rules only), Admin Custom (admin writes additional instructions), and User Choice (users can provide their own tailoring instructions via pre-built templates or free-text). The base system prompt (truthfulness constraints, forbidden operations, JSON output format) is always locked and non-removable.

### Implementation Notes

**Schema:**
- New `system_config` table: key-value store for admin settings, RLS enabled with admin-only access. Keys: `tailoring_prompt_mode` (enum: `system_default`, `admin_custom`, `user_choice`; default: `system_default`), `tailoring_prompt_admin_text` (text, nullable).
- Add `tailoring_instructions` TEXT column to `search_preferences` (nullable, user's custom tailoring prompt).
- RLS: `system_config` readable by authenticated users (they need to check the mode), writable only by admin (service role or admin check).

**Backend:**
- Server Actions: `getSystemConfig(key)` — reads a config value. `setSystemConfig(key, value)` — admin-only, validates against `ADMIN_EMAILS` env var or profile flag. `getTailoringConfig()` — returns mode + admin text + whether user instructions are enabled. `setTailoringInstructions(text)` — user action, saves to `search_preferences.tailoring_instructions`.
- Update `supabase/functions/_shared/agents/tailoring.ts`:
  - Before calling Claude, fetch `tailoring_prompt_mode` and `tailoring_prompt_admin_text` from `system_config`.
  - If mode is `admin_custom`, append admin text to system prompt as `## Additional Tailoring Instructions (Admin)`.
  - If mode is `user_choice`, fetch user's `tailoring_instructions` from `search_preferences`, append admin text (if any) as `## Admin Base Instructions`, then user text as `## User Tailoring Preferences`.
  - If mode is `system_default`, use base prompt only.
  - The base system prompt sections (Truthfulness, Forbidden Operations, Output Format) are always first and non-removable.

**Frontend — Admin UI:**
- Add tailoring prompt config section to the admin dashboard (`/admin/pipeline` or a new `/admin/settings` route).
- Three-option radio/select for mode: System Default, Admin Custom, User Choice.
- When Admin Custom or User Choice is selected, show a textarea for admin instructions.
- Save button calls `setSystemConfig`.

**Frontend — User UI:**
- In Settings (profile/preferences section), show a "Resume Tailoring Style" section — **only visible when mode = `user_choice`**.
- Template dropdown with pre-built options:
  - "Start from scratch" (clears textarea)
  - "Technical depth — Prioritize technical skills, frameworks, and architecture decisions. Highlight system design work and engineering complexity."
  - "Leadership focus — Emphasize team leadership, cross-functional collaboration, and strategic decision-making. Lead with scope of impact."
  - "Metrics-driven — Lead every achievement bullet with a quantified result. Prioritize revenue impact, performance improvements, and measurable outcomes."
  - "Concise — Keep the resume tight. 2-3 positions max, 3 bullets each. Only include what's directly relevant to the target role."
  - "Career changer — Highlight transferable skills and relevant adjacent experience. De-emphasize industry-specific jargon from previous field."
- Free-text textarea below the dropdown (pre-filled by template, fully editable).
- Save button calls `setTailoringInstructions`.
- Microcopy explaining what this does: "These instructions guide how Woodhouse tailors your resume for each job. The system's safety rules (truthfulness, no fabrication) always apply."

### Acceptance Criteria

- [ ] `system_config` table exists with RLS (authenticated can read, admin-only can write)
- [ ] `search_preferences.tailoring_instructions` column exists (nullable TEXT)
- [ ] Admin can set tailoring mode to `system_default`, `admin_custom`, or `user_choice`
- [ ] Admin can write custom instructions when mode is `admin_custom` or `user_choice`
- [ ] Tailoring agent appends admin instructions when mode is `admin_custom`
- [ ] Tailoring agent appends admin + user instructions when mode is `user_choice`
- [ ] Base system prompt (truthfulness, forbidden ops, output format) is always present and non-removable
- [ ] User sees "Resume Tailoring Style" section in Settings only when mode is `user_choice`
- [ ] User can select from pre-built templates or write custom instructions
- [ ] User instructions are saved to `search_preferences.tailoring_instructions`
- [ ] When mode is `system_default`, no custom instructions are appended — original behavior unchanged

---

# E10 — Application Tracker

## E10-01 — Tracker Kanban Board

**Type:** Frontend
**Depends on:** E9-03
**Masterplan:** MP §3 Flow 6, MP §9 Screen 19

### Description

Build the application tracker with a kanban board for tracking submitted applications.

### Implementation Notes

- Route: `(app)/tracker/page.tsx`.
- Kanban columns: Submitted, Acknowledged, Screening, Interviewing, Offer, Accepted, Rejected, Withdrawn.
- Each card: company name, job title, days since last update, small match score badge.
- Cards are draggable between columns (use `@dnd-kit/core` or similar). Dropping updates the application status via Server Action.
- Top bar: filter by date range, search by company/title. Stats summary: total in pipeline, response rate, average days to response.
- Empty state: "No applications tracked yet. Approve applications from your Review Queue to start tracking."

### Acceptance Criteria

- [ ] `/tracker` renders a kanban board with 8 status columns
- [ ] Only applications with status in ['submitted', 'acknowledged', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn'] appear
- [ ] Each card shows company, title, days since last update, match score badge
- [ ] Dragging a card between columns updates the application status in the database
- [ ] Status change is logged as an `application_events` entry
- [ ] Search filters cards by company name or job title
- [ ] Stats summary shows: total in pipeline, response rate, average days to response
- [ ] Empty state displays when no submitted applications exist

---

## E10-02 — Tracker Detail Screen

**Type:** Frontend
**Depends on:** E10-01
**Masterplan:** MP §9 Screen 20

### Description

Build the tracker detail screen for a single submitted application with timeline, notes, and reminders.

### Implementation Notes

- Route: `(app)/tracker/[id]/page.tsx`.
- Header: company, title, status badge, match score. Quick actions: Update Status (dropdown), Add Note, Set Reminder.
- Timeline: vertical timeline of all `application_events` for this application. Most recent at top.
- Materials: collapsible sections for tailored resume (download links), cover letter, application answers.
- Notes: free-form textarea. "Add Note" creates an `application_events` entry with type='note_added'.
- Reminders: date picker to set a follow-up date. Stores in `applications.next_step_date`. System creates a notification on that date (notification creation happens in E11-01).

### Acceptance Criteria

- [ ] `/tracker/:id` shows application header with company, title, status badge, match score
- [ ] Timeline displays all application events in reverse chronological order
- [ ] "Update Status" dropdown changes the application status and logs an event
- [ ] "Add Note" saves a note and creates an application_event entry
- [ ] Materials section shows downloadable resume (PDF/DOCX), cover letter text, application answers
- [ ] "Set Reminder" saves a date to `next_step_date`
- [ ] Reminder date is displayed if set

---

# E11 — Notifications & Email

## E11-01 — In-App Notification System

**Type:** Integration
**Depends on:** E10-02
**Masterplan:** MP §4 Notifications, MP §7 Notifications table, MP §8 Notifications endpoints, MP §9 Screen 24

### Description

Build the in-app notification system: creation, display, and management.

### Implementation Notes

- Notification types from MP §7: new_matches, applications_ready, follow_up_reminder, status_stale, subscription_warning, system.
- Create a notification helper function `createNotification(profileId, type, title, body, metadata)` used by the pipeline and other systems.
- Create notification API endpoints per MP §8: GET (paginated, filterable by read), PATCH mark read, POST mark all read.
- Build the notifications screen at `(app)/notifications/page.tsx`: list of notifications with read/unread state, click to mark as read.
- Add a notification bell icon to the app shell sidebar/top bar with unread count badge.
- Subscribe to Realtime on the `notifications` table for live updates.
- Create a cron or trigger for: follow-up reminders (when `applications.next_step_date <= now()`), status stale warnings (14 days no update on 'submitted').

### Acceptance Criteria

- [ ] `createNotification()` helper creates notification records in the database
- [ ] Pipeline creates notifications when applications become 'ready'
- [ ] `/notifications` screen shows all notifications sorted by date, most recent first
- [ ] Unread notifications are visually distinct from read ones
- [ ] Clicking a notification marks it as read
- [ ] "Mark all as read" button marks all notifications as read
- [ ] Notification bell in the sidebar shows unread count
- [ ] Unread count updates in real-time via Realtime subscription
- [ ] Follow-up reminders fire when `next_step_date` passes
- [ ] Status stale warnings fire after 14 days with no update on 'submitted' applications

---

## E11-02 — Email Digest

**Type:** Backend
**Depends on:** E11-01
**Masterplan:** MP §4 Notifications (email digest), MP §7 Profiles (email_digest field)

### Description

Build the email digest system that sends daily or weekly summaries to users.

### Implementation Notes

- Create a `send-email-digest` Edge Function triggered by pg_cron (daily at 8am UTC).
- Query users where `email_digest` is 'daily' (or 'weekly' on Mondays).
- For each user, aggregate: new matched jobs since last digest, applications ready for review, applications needing status updates.
- Send email via SendGrid (or Resend) with a clean HTML template.
- Include a one-click unsubscribe link.
- Track last digest sent timestamp to avoid duplicates.

### Acceptance Criteria

- [ ] Email digest Edge Function sends emails to users with `email_digest = 'daily'` once per day
- [ ] Weekly digest sends on Mondays to users with `email_digest = 'weekly'`
- [ ] Email includes: count of new matches, applications ready for review, stale applications
- [ ] Email has a professional HTML template with Woodhouse branding
- [ ] Unsubscribe link sets `email_digest = 'none'`
- [ ] Users with `email_digest = 'none'` receive no emails
- [ ] pg_cron SQL is provided for daily scheduling

---

## E11-03 — Email Forwarding Inbound Parse

**Type:** Integration
**Depends on:** E11-02
**Masterplan:** MP §3 Flow 2 (Source: Email Forwarding), MP §6 Email Forwarding Architecture, MP §8 POST /api/webhooks/email-inbound

### Description

Build the email forwarding system that lets users forward job alert emails to Woodhouse for parsing and ingestion.

### Implementation Notes

- Generate a unique forwarding address per user: `jobs+{short_id}@inbound.woodhouse.app`. Store in `profiles.forwarding_address` during onboarding or settings.
- Set up SendGrid Inbound Parse webhook pointing to `POST /api/webhooks/email-inbound`.
- The webhook handler: verifies SendGrid signature, identifies user by forwarding address, calls Haiku to extract job posting data from email HTML, creates `job_postings` record with source='email', enqueues `pipeline_jobs` with `step='pre_screen'`.
- Handle edge cases: unrecognized forwarding address → log and discard. Parsing fails → save raw email data, notify user.

### Acceptance Criteria

- [ ] Each user gets a unique forwarding address stored in `profiles.forwarding_address`
- [ ] `POST /api/webhooks/email-inbound` validates SendGrid webhook signature
- [ ] Webhook identifies the user by matching the recipient address to `profiles.forwarding_address`
- [ ] Haiku parses the email HTML to extract job posting details
- [ ] Parsed posting is saved to `job_postings` with source='email'
- [ ] A pipeline job with `step='pre_screen'` is enqueued for the new posting
- [ ] Unrecognized forwarding addresses are logged and discarded (no error response)
- [ ] Parse failures save the raw email and create a notification for the user

---

# E12 — Subscription & Payments

## E12-01 — Stripe Setup

**Type:** Setup
**Depends on:** E11-03
**Masterplan:** MP §6 Stack (Stripe), MP §11 Revenue Model

### Description

Set up Stripe products, prices, and the customer portal for subscription billing.

### Implementation Notes

- Install `stripe` npm package.
- Create Stripe products and prices (in Stripe Dashboard or via API):
  - Pro Monthly: $19/mo. Pro Annual: $190/yr.
  - Premium Monthly: $39/mo. Premium Annual: $390/yr.
- Create `src/lib/stripe.ts` — server-side Stripe client initialization.
- Set up Stripe Customer Portal for self-service subscription management.
- Create `POST /api/webhooks/stripe` per MP §8: handles checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed.
- Webhook updates `subscriptions` table: plan, status, stripe_customer_id, stripe_subscription_id, current_period_start/end, applications_limit (50 for pro, 200 for premium).

### Acceptance Criteria

- [ ] Stripe products and prices exist for Pro and Premium tiers (monthly + annual)
- [ ] `src/lib/stripe.ts` exports a configured Stripe client (server-side only)
- [ ] `POST /api/webhooks/stripe` validates Stripe webhook signatures
- [ ] Webhook handles `checkout.session.completed`: creates/updates subscription with correct plan and limits
- [ ] Webhook handles `customer.subscription.updated`: updates plan, status, period dates, limits
- [ ] Webhook handles `customer.subscription.deleted`: sets plan to 'free', status to 'cancelled', limit to 5
- [ ] Webhook handles `invoice.payment_failed`: sets subscription status to 'past_due'
- [ ] Stripe Customer Portal is configured for subscription management

---

## E12-02 — Subscription Management Screen

**Type:** Frontend
**Depends on:** E12-01
**Masterplan:** MP §9 Screen 25, MP §11 Pricing Tiers

### Description

Build the subscription management screen showing current plan, usage, and upgrade/downgrade options.

### Implementation Notes

- Route: `(app)/settings/subscription/page.tsx`.
- Current plan card: plan name, usage bar (X of Y applications used), period reset date.
- Upgrade buttons: create a Stripe Checkout session and redirect to Stripe-hosted checkout.
- If on paid plan: "Manage Billing" button opens Stripe Customer Portal.
- Downgrade: handled through Stripe Customer Portal (cancellation takes effect at period end).
- Show the three-tier pricing comparison from MP §11.

### Acceptance Criteria

- [ ] `/settings/subscription` shows the current plan name and status
- [ ] Usage bar shows applications used vs. limit with visual progress
- [ ] Period reset date is displayed
- [ ] "Upgrade to Pro" button creates a Stripe Checkout session and redirects
- [ ] "Upgrade to Premium" button creates a Stripe Checkout session and redirects
- [ ] "Manage Billing" button (paid plans only) opens Stripe Customer Portal
- [ ] Pricing comparison table shows all three tiers with feature details
- [ ] Free users see a compelling upgrade prompt

---

## E12-03 — Usage Enforcement & Feature Gating

**Type:** Integration
**Depends on:** E12-02
**Masterplan:** MP §11 Billing, MP §11 Expansion Motion

### Description

Enforce subscription limits and gate features by tier across the application.

### Implementation Notes

- Create a `checkSubscription(profileId)` utility that returns: plan, applications_used, applications_limit, features (cover_letter_enabled, full_tracker, email_forwarding, etc.).
- Application approval (E8-04) already checks the limit. Add: when free user hits limit, show blurred prepared applications with upgrade prompt.
- Feature gating:
  - Cover letter generation: Pro/Premium only (Free users skip cover letter in pipeline).
  - Application answers: Free gets basic (3 fields), Pro/Premium gets full.
  - Email forwarding: Pro/Premium only.
  - Full tracker (timeline, notes, reminders): Pro/Premium only. Free gets status-only.
  - Resume format: Free = PDF only. Pro/Premium = PDF + DOCX.
- Reset `applications_used` to 0 at the start of each billing period (via Stripe webhook on subscription renewal, or a daily cron that checks `current_period_end`).

### Acceptance Criteria

- [ ] Free users are blocked from approving more than 5 applications per period with an upgrade prompt
- [ ] Blocked applications show materials blurred/locked with an upgrade CTA
- [ ] Cover letter is not generated for free-tier users in the pipeline
- [ ] Free users get 3 application answer fields; Pro/Premium get all
- [ ] Email forwarding address is hidden/disabled for free users
- [ ] Free tracker shows status only; Pro/Premium shows full timeline and notes
- [ ] Free resume download offers PDF only; Pro/Premium offers PDF + DOCX
- [ ] `applications_used` resets to 0 at the start of each billing period
- [ ] All feature checks use the centralized `checkSubscription()` utility

---

# E13 — Settings

## E13-01 — Profile & Preferences Settings

**Type:** Frontend
**Depends on:** E12-03
**Masterplan:** MP §9 Screens 22-23

### Description

Build the profile settings and search preferences screens for editing after onboarding.

### Implementation Notes

- Route: `(app)/settings/profile/page.tsx` and `(app)/settings/preferences/page.tsx`.
- Profile: same fields as onboarding but in an edit-in-place format. Sections: Basic Info, Professional Summary, Work Experience, Education, Skills, Projects, Certifications. Each section is collapsible with an "Edit" button. AI assist buttons available.
- Preferences: search preferences form, email forwarding address with copy button, current scan frequency display (derived from plan, with upgrade prompt for free users), tracked boards management (add/remove Greenhouse and Lever board URLs with platform validation), email digest preference dropdown.
- Reuse Server Actions from E4-01 for all profile CRUD.
- Use the tracked board Server Actions from E5-02.

### Acceptance Criteria

- [ ] `/settings/profile` shows all knowledge base fields in collapsible, editable sections
- [ ] Editing and saving profile fields updates the database
- [ ] AI assist buttons (improve bullet, suggest skills, generate summary) work from settings
- [ ] `/settings/preferences` shows all search preference fields
- [ ] Tracked boards section allows adding Greenhouse/Lever board URLs
- [ ] Adding a board validates URL format (must be greenhouse or lever domain)
- [ ] Removing a board deletes it from the database
- [ ] Email forwarding address is displayed with a copy button
- [ ] Scan frequency shows the tier-derived interval with upgrade prompt for free users
- [ ] Email digest dropdown saves preference changes

---

## E13-02 — Account Settings

**Type:** Frontend
**Depends on:** E13-01
**Masterplan:** MP §9 Screen 26

### Description

Build the account settings screen for email, password, notification preferences, and account deletion.

### Implementation Notes

- Route: `(app)/settings/account/page.tsx`.
- Change email: updates via Supabase Auth `updateUser({ email })`. Requires re-verification.
- Change password: `updateUser({ password })`. Requires current password confirmation.
- Notification preferences: toggles for each notification type (new matches, applications ready, follow-up reminders, status stale) × channel (in-app, email).
- "Delete Account" danger zone at bottom: confirmation modal, then deletes the auth user (CASCADE deletes all profile data).

### Acceptance Criteria

- [ ] Change email sends a verification email and updates on confirmation
- [ ] Change password requires current password and updates on success
- [ ] Notification preference toggles save to the database
- [ ] "Delete Account" button shows a confirmation modal with warning text
- [ ] Confirming deletion deletes the auth user and all associated data (CASCADE)
- [ ] After deletion, user is redirected to the landing page

---

# E14 — Admin & Observability

## E14-01 — Pipeline Admin Dashboard

**Type:** Frontend
**Depends on:** E13-02
**Masterplan:** MP §9 Screen 27

### Description

Build the internal admin dashboard for monitoring pipeline health, costs, and error rates.

### Implementation Notes

- Route: `(app)/admin/pipeline/page.tsx`. Protected by admin check (check against an `ADMIN_EMAILS` environment variable or a profile flag).
- No sidebar — simple nav with logo + "Back to Dashboard."
- Sections per MP §9 Screen 27:
  - Pipeline Health: 4 stat cards (Pending, Processing, Failed last 24h, Zombie).
  - Jobs by Step: table with counts per step × status.
  - Error Log: scrollable list of recent failed pipeline jobs (timestamp, step, user, posting title, error, attempts). Click expands to show full input_data/output_data.
  - Per-User Cost: table of top users by token usage (requires Langfuse API integration or query from pipeline_jobs output_data).
  - Validation Failure Rate: count and percentage over last 7 days by agent type.
- All data comes from querying `pipeline_jobs` table directly (no need for a separate analytics table).

### Acceptance Criteria

- [ ] `/admin/pipeline` is only accessible to admin users (non-admins see 403)
- [ ] Pipeline Health section shows: pending count, processing count, failed (24h), zombie count
- [ ] Jobs by Step table shows counts for each of the 5 steps × 4 statuses
- [ ] Error Log shows recent failures with: timestamp, step, error message, attempt count
- [ ] Clicking an error log entry shows full input_data and output_data
- [ ] Per-User Cost section shows top users by estimated API cost
- [ ] Validation Failure Rate section shows failure % by agent type
- [ ] Page auto-refreshes data every 30 seconds

---

# E15 — Landing Page & Polish

## E15-01 — Marketing Landing Page

**Type:** Frontend
**Depends on:** E14-01
**Masterplan:** MP §9 Screen 1, MP §10 Design System, MP §11 Pricing Tiers, MP §12 GTM Strategy

### Description

Build the public marketing landing page with hero, features, pricing, and CTAs.

### Implementation Notes

- Route: `(marketing)/page.tsx` (no sidebar, no auth required).
- Sections per MP §9:
  - Hero: "Your AI Recruiting Agent." + subheading + "Get Started Free" CTA.
  - How It Works: three-step visual (set up profile → Woodhouse scans → review and apply).
  - Features Grid: 6 cards (Automated Discovery, Smart Matching, Resume Tailoring, Material Generation, Review Queue, Application Tracking).
  - Pricing: three-tier table from MP §11 (Free, Pro $19/mo, Premium $39/mo).
  - Footer: links, legal, contact.
- Sticky top nav: logo, "Sign In" link, "Get Started" CTA button.
- Design system colors, typography, spacing from MP §10.
- Responsive design: works on mobile (single column), tablet (two columns), desktop (full layout).

### Acceptance Criteria

- [ ] `/` renders the marketing landing page (no auth required)
- [ ] Hero section with headline, subheading, and "Get Started Free" CTA
- [ ] "Get Started Free" navigates to `/signup`
- [ ] How It Works section shows 3 steps with icons and descriptions
- [ ] Features Grid shows 6 feature cards
- [ ] Pricing table shows all three tiers with features and "Get Started" / "Upgrade" buttons
- [ ] Footer with relevant links
- [ ] Page is fully responsive: mobile, tablet, desktop
- [ ] Design matches MP §10 colors, typography, and spacing
- [ ] Page loads in under 2 seconds (no heavy dependencies)

---

## E15-02 — Loading States, Empty States & Final Polish

**Type:** Polish
**Depends on:** E15-01
**Masterplan:** MP §10 Design System (Loading State, Empty State, Toast Notifications, Interaction Principles)

### Description

Add loading skeletons, empty states, error states, and final polish across all screens.

### Implementation Notes

- Loading states: skeleton loaders matching content shapes for all data-fetching pages (dashboard, job feed, queue, tracker). Use shadcn/ui Skeleton component.
- Empty states: centered illustration/icon + heading + description + CTA for all list/feed views (MP §10). Specific messages per screen (e.g., job feed empty state, queue empty state, tracker empty state).
- Error states: error boundaries for each route segment. User-friendly error messages with "Try again" button.
- Toast notifications: bottom-right corner, auto-dismiss 5 seconds, 4 types (success, error, info, warning) per MP §10.
- Optimistic updates: status changes (approve, skip, mark read) update UI immediately, revert on error.
- Keyboard navigation: all interactive elements focusable via Tab, Enter/Space to activate, Escape to close modals.
- Responsive breakpoints: verify all 27 screens at desktop (1280px+), tablet (768-1279px), mobile (<768px).
- Verify no console errors, no TypeScript errors, no broken links.

### Acceptance Criteria

- [ ] All data-loading screens show skeleton loaders while fetching
- [ ] All list views have specific empty state messages when no data exists
- [ ] Route-level error boundaries catch and display user-friendly error messages
- [ ] Toast notifications appear for: successful actions, errors, status changes
- [ ] Optimistic updates work for: approve, skip, mark notification read
- [ ] All interactive elements are keyboard-accessible (Tab, Enter, Escape)
- [ ] All 27 screens render correctly at desktop, tablet, and mobile breakpoints
- [ ] No console errors or TypeScript compilation errors
- [ ] No broken links or dead routes
- [ ] Sidebar collapses correctly on tablet and becomes bottom nav on mobile

---

*End of Build Plan*
