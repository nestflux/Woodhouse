# Woodhouse

**Your AI recruiting agent.** Finds jobs, tailors resumes, and prepares applications — while you focus on what matters.

Woodhouse is a multi-user SaaS platform that acts as a personal AI-powered recruiting agent. It continuously discovers job postings, evaluates each one against your professional profile, generates tailored application materials, and queues everything for your review. You approve and submit. The system handles everything else.

## Documentation

| Resource | Link |
|----------|------|
| Live Docs | [woodhouse-docs.surge.sh](https://woodhouse-docs.surge.sh) |
| Masterplan | [Full product specification](https://woodhouse-docs.surge.sh/masterplan.html) |
| Build Plan | [15 epics, 43 issues](https://woodhouse-docs.surge.sh/buildplan.html) |
| Prototype | [Interactive 27-screen prototype](https://woodhouse-docs.surge.sh/prototype.html) |
| AI Research | [Agent architecture research](https://woodhouse-docs.surge.sh/research.html) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui v4 |
| Backend | Next.js Server Actions, Supabase Edge Functions (Deno) |
| Database | Supabase Postgres with RLS |
| Auth | Supabase Auth (email/password) |
| AI | Anthropic Claude API — Sonnet 4.6 + Haiku 4.5 |
| Observability | Langfuse (LLM tracing), Sentry (errors) |
| Payments | Stripe |

## Architecture

```
User Profile → Discovery Agents → Pre-Screen (Haiku) → Evaluation (Sonnet)
                                                              ↓
                                                    Tailoring Agent (Sonnet)
                                                              ↓
                                                    Materials Agent (Sonnet + Haiku)
                                                              ↓
                                                    Review Queue → Approve → Submit
```

All agent execution goes through the `pipeline_jobs` table using a claim-based queue pattern (`SELECT FOR UPDATE SKIP LOCKED`). Jobs are never called directly from the frontend — they're always enqueued, claimed by a worker, executed, and the next step is enqueued.

**AI Agents:**
- **Discovery** — Aggregates jobs from SerpAPI (Google Jobs), JSearch, and ATS boards (Greenhouse, Lever, Workday)
- **Pre-Screen** (Haiku 4.5) — Fast disqualification on 4 criteria: title match, country, seniority, salary
- **Evaluation** (Sonnet 4.6) — 5-dimension scoring (skills, experience, seniority, location, technology) with weighted composite
- **Tailoring** (Sonnet 4.6) — Customizes resume for each job using only verified knowledge base entries
- **Materials** (Sonnet 4.6 + Haiku 4.5) — Generates cover letters and application answers

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- Anthropic API key (for AI agents)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/nestflux/Woodhouse.git
   cd Woodhouse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` with the required environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Push database migrations:
   ```bash
   npx supabase db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Edge Function Deployment

```bash
npx supabase functions deploy <function-name> --project-ref <your-project-ref>
```

Available functions: `process-pipeline`, `discover-jobs`, `trigger-discoveries`, `parse-resume`, `ai-assist`, `parse-job-url`, `generate-resume-files`

## Project Status

**70% complete** — 30 of 43 issues done across 9 of 15 epics.

| Epic | Status | Description |
|------|--------|-------------|
| E1 — Environment | Done | Next.js 16 + Supabase + Tailwind 4 + shadcn/ui v4 |
| E2 — Database & Auth | Done | 16 tables, RLS, auth flows, sidebar, app shell |
| E3 — AI Infrastructure | Done | Anthropic SDK, Langfuse, Sentry, pipeline worker, Zod validators |
| E4 — Onboarding | Done | 8-step wizard, resume parsing, AI assist |
| E5 — Job Discovery | Done | Aggregator APIs, ATS boards, cron scheduling |
| E6 — Job Evaluation | Done | Pre-screen, full evaluation, manual job addition |
| E7 — Tailoring & Materials | Done | Resume tailoring, cover letters, application answers |
| E8 — Review Queue | Done | Queue management, application detail, approve flow |
| E9 — Dashboard & Job Feed | Done | Dashboard, job feed, job detail screen |
| E10 — Application Tracker | In Progress | Kanban board, tracker detail |
| E11 — Notifications | Planned | In-app notifications, email digests |
| E12 — Payments | Planned | Stripe subscriptions, usage gating |
| E13 — Settings | Planned | Profile management, account settings |
| E14 — Admin | Planned | Pipeline monitoring, retry controls |
| E15 — Landing & Polish | Planned | Marketing page, responsive polish |

## Design System

| Token | Value |
|-------|-------|
| Primary (Navy) | `#1e3a5f` |
| Accent (Amber) | `#d97706` |
| Success (Green) | `#059669` |
| Error (Red) | `#dc2626` |
| Font | Inter |
| Border radius | `8px` (cards/buttons) |
| Spacing base | `4px` |

Score badge colors: green for 80+, yellow for 60–79, red for below 60.

## License

Private. All rights reserved.
