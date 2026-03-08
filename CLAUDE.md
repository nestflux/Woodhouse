# Woodhouse — Claude Code Session Rules

These rules apply to every session, every issue, without exception.
Do not deviate from them unless explicitly told to in the chat.

## Reference Documents

| Shorthand | Full Name | File |
|-----------|-----------|------|
| MP | Master Plan | `woodhouse_masterplan.md` |
| BP | Build Plan | `woodhouse_buildplan.md` |

When an issue says "MP §11" — open `woodhouse_masterplan.md` and find
Section 11. Never assume you know what the document says. Read it.

---

## Rule 1 — Read Before You Code

Every issue in the build plan lists master plan section refs.
Read those sections BEFORE writing a single line of code.

The documents contain exact field names, enum values, component structures,
and constraints that are NOT repeated in the issue description.
Skipping them causes drift and rework.

---

## Rule 2 — Stack: Next.js + Supabase + Tailwind + Anthropic. No Substitutions.

**Frontend:** Next.js 16+ with App Router. Not Pages Router. Not Remix. Not Vite.
- React Server Components by default. Only use `"use client"` when interactivity is required.
- Tailwind CSS 4 for all styling (CSS-based `@theme` config, not `tailwind.config.js`). Not CSS modules. Not styled-components. Not Emotion.
- shadcn/ui v4 for components (Base UI primitives). Not Material UI. Not Chakra. Not Ant Design.
- Inter font via `next/font/google`. Not a CDN link.

**Backend:** Supabase Edge Functions (Deno runtime) for all AI agents and pipeline processing. Next.js Server Actions for profile CRUD and authenticated data mutations. Next.js API Routes for webhooks only (Stripe, SendGrid).

**Database:** Supabase Postgres. Not PlanetScale. Not Neon. Not Prisma — use `@supabase/supabase-js` and `@supabase/ssr` directly.

**Auth:** Supabase Auth with email/password. Not NextAuth. Not Clerk. Not Auth0.

**AI:** Anthropic Claude API via `@anthropic-ai/sdk`. Not OpenAI. Not LangChain. Not any agent framework.
- Sonnet 4.6 (`claude-sonnet-4-6`) for evaluation, tailoring, cover letters, achievement improvement.
- Haiku 4.5 (`claude-haiku-4-5`) for pre-screen, parsing, skill suggestion, application answers.

**Observability:** Langfuse for all LLM call tracing. Not Helicone. Not custom logging.

**Payments:** Stripe with `stripe` Node SDK. Not Lemon Squeezy. Not Paddle.

**Environment variables** live in `.env.local` (Next.js) and Supabase project secrets (Edge Functions):

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only |
| `ANTHROPIC_API_KEY` | Edge Functions only |
| `SERPAPI_API_KEY` | Edge Functions only |
| `JSEARCH_API_KEY` | Edge Functions only |
| `STRIPE_SECRET_KEY` | Server Actions / API Routes |
| `STRIPE_WEBHOOK_SECRET` | API Routes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client |
| `NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID` | Client + Server |
| `NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID` | Client + Server |
| `NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID` | Client + Server |
| `NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID` | Client + Server |
| `SENDGRID_API_KEY` | Edge Functions only |
| `SENDGRID_FROM_EMAIL` | Edge Functions only |
| `SENDGRID_WEBHOOK_SECRET` | API Routes |
| `LANGFUSE_SECRET_KEY` | Edge Functions only |
| `LANGFUSE_PUBLIC_KEY` | Edge Functions only |
| `LANGFUSE_BASE_URL` | Edge Functions only |
| `SENTRY_DSN` | Server + Edge Functions |
| `NEXT_PUBLIC_APP_URL` | Client + Server |
| `ADMIN_EMAILS` | Server only |
| `ADMIN_EMAILS` | Server only |

Never hardcode credentials. Never expose service role keys, API keys, or secrets to the client. Variables marked "Edge Functions only" must never appear in Next.js server code or client bundles.

---

## Rule 3 — One Issue at a Time

Do not start the next issue until the current one is complete and every
acceptance criteria item is confirmed.

Critical path:
```
E1-01 → E1-02 → E1-03 → E2-01 → E2-02 → E2-03 → E2-04 → E2-05
→ E3-01 → E3-02 → E3-03 → E3-04 → E4-01 → E4-02
→ E5-01 → E5-02 → E5-03 → E6-01 → E6-02 → E6-03
→ E7-01 → E7-02 → E7-03 → E8-01 → E8-02 → E8-03 → E8-04
→ E9-01 → E9-02 → E9-03 → E9-04 → E10-01 → E10-02
→ E11-01 → E11-02 → E11-03 → E12-01 → E12-02 → E12-03
→ E13-01 → E13-02 → E14-01 → E15-01 → E15-02
```

If you think you should jump ahead, ask first.

---

## Rule 4 — Three-Gate Autonomous Review

After finishing an issue, run all three gates in order before advancing.
If any gate fails, fix the issue and re-run that gate.
Only advance when all three pass.

### Gate 1 — Acceptance Criteria Verification (self)

Go through each AC item one by one. For each, provide concrete evidence
(test output, file path, command run, etc.).

```
[PASS] [criteria text] — [how you verified it]
[FAIL] [criteria text] — [what is failing and why]
```

All items must PASS before proceeding to Gate 2.

### Gate 2 — Masterplan Cross-Reference Audit (agent)

Dispatch an agent to re-read every Masterplan section referenced by the issue.
The agent's sole job: compare what Masterplan specifies against what was
actually implemented. It looks for missed columns, behaviors, constraints,
tables, edge cases — anything in Masterplan not reflected in code.

Report format:
```
[CLEAN] — no gaps found between Masterplan and implementation
[GAP] [what Masterplan says] → [what is missing or wrong in code]
```

All gaps must be fixed before proceeding to Gate 3.

### Gate 3 — Code Review (agent)

Dispatch the code-reviewer agent to review all code changes for the issue against:
- The acceptance criteria
- CLAUDE.md rules (stack, production quality, technical constraints)
- General code quality (error handling, types, no TODOs, no hardcoded values, no console.log)

Report format:
```
[APPROVED] — no issues found
[ISSUE] [severity] [description] → [suggested fix]
```

All issues must be resolved before the issue is considered complete.

---

## Rule 5 — Production Quality. No Exceptions.

This is a launch-grade product, not a prototype. Every issue is built to
production standard — full stop.

- Handle all edge cases and errors gracefully.
- AI agent failures must never crash the pipeline. Mark as failed, retry with backoff, continue other jobs.
- Add the finishing touches: empty states, loading skeletons, helpful microcopy.
- Match the design system exactly: Navy `#1e3a5f`, Amber `#d97706`, Inter font, 4px spacing base, `--radius-md: 8px` for cards/buttons.
- Match score badge colors: green (`#059669`) for 80+, yellow (`#d97706`) for 60-79, red (`#dc2626`) for below 60.
- Zero hackathon shortcuts, zero TODOs left in code, zero hardcoded values.

You are the technical co-founder on this project. Own it.

---

## Rule 6 — Standing Technical Constraints

These apply to every issue without needing to be restated:

- **Primary keys:** UUID via `gen_random_uuid()`. Every table. No exceptions.
- **Timestamps:** `TIMESTAMPTZ DEFAULT now() NOT NULL` for `created_at` and `updated_at`. Every table has both.
- **RLS on every table.** Users can only access their own data. `job_postings` and `pipeline_jobs` use service role access (no restrictive policies), but RLS is still enabled.
- **AI calls are server-side only.** All Anthropic API calls happen in Supabase Edge Functions. The frontend never calls Claude directly. The `ANTHROPIC_API_KEY` never appears in Next.js code.
- **Structured output + Zod validation.** Every LLM response is parsed as JSON and validated against a Zod schema with `safeParse`. If validation fails, the pipeline job is marked as failed and retried. Never trust raw LLM output.
- **Prompt caching.** Use Anthropic prompt caching for user profile context in Evaluation and Tailoring agents. The user's full profile is sent as a `cache_control: { type: "ephemeral" }` system message block. This cuts input token costs ~90% for repeated evaluations within the cache TTL.
- **Langfuse tracing on every AI call.** Every `callClaude` invocation must be wrapped with a Langfuse trace that includes: agent type, user ID, duration, token counts, cache read tokens, success/failure.
- **Supabase client usage:** Server Components/Actions use `createServerClient` from `@supabase/ssr`. Client Components use `createBrowserClient` from `@supabase/ssr`. Edge Functions use `createClient` from `@supabase/supabase-js` with the service role key.
- **Pipeline queue pattern.** All agent execution goes through the `pipeline_jobs` table. Jobs are claimed with `SELECT FOR UPDATE SKIP LOCKED`. Never call agents directly from the frontend or from other agents. The sequence is always: enqueue → worker claims → worker executes → worker enqueues next step.
- **Truthfulness constraint.** The Tailoring and Materials agents may only use information present in the user's knowledge base. Every tailored achievement must reference a `source_id` from the original knowledge base entry. The system prompt must state this constraint explicitly.
- **Internationalization.** Never assume a specific country. Profiles, work experiences, and job postings all have `country` fields. Search preferences have `target_countries` and `salary_currency`. Discovery agents accept country parameters. Pre-screen checks country compatibility.
- **Realtime for pipeline status.** The frontend subscribes to Supabase Realtime on `applications` and `discovery_runs` tables for live updates. Never poll for status changes.

---

## Rule 7 — Advance and Report

When all three gates pass, execute this sequence and keep moving:

1. Update `CLAUDE.md` `## Current Status`:
   - Move completed issue to "Last completed"
   - Set "Currently working" to next issue
   - Set "Next up" to the issue after that
2. Post completion report:

```
=== ISSUE COMPLETE: [ID] — [title] ===
Gate 1 (AC):          [X/X PASS]
Gate 2 (Masterplan):  [CLEAN | X gaps fixed]
Gate 3 (Code Review): [APPROVED | X issues fixed]
Next: [next ID] — [next title]
=====================================
```

3. Advance immediately to the next issue.

### When to STOP:

- A gate fails twice on the same item after fix attempts
- A blocker requires owner action (missing API key, external access, ambiguous spec)
- Critical path is complete (all issues done)

In these cases, post the report and wait for the owner.

---

## Current Status

Last completed: E15-01 (Marketing Landing Page)
Currently working: E15-02 (Loading States, Empty States & Final Polish)
Next up: Complete — all issues done
