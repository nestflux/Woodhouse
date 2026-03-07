# Woodhouse — Masterplan

> **Version:** 1.2
> **Date:** 2026-03-07
> **Status:** Final Draft
> **Changelog:**
> - v1.3 — Internationalization: added country fields to profiles, work_experiences, and job_postings. Added target_countries to profiles. Added salary_currency to search_preferences. Removed US-centric defaults throughout.
> - v1.2 — Worker loop pattern for throughput, tracked_boards table, per-user cron scheduling via next_discovery_at, pre-screen failure handling (Option B), Materials Agent split (Sonnet + Haiku), scan interval tier enforcement, updated architecture diagram, flow consistency with queue pattern.
> - v1.1 — Integrated AI architecture research findings: pipeline queue table, concurrency control, exponential backoff, Zod validation, Anthropic prompt caching, Haiku pre-screen, Langfuse observability, Premium tier soft cap.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [User Personas](#2-user-personas)
3. [Core User Flows](#3-core-user-flows)
4. [Feature Set](#4-feature-set)
5. [AI Agent Architecture](#5-ai-agent-architecture)
6. [Technical Architecture](#6-technical-architecture)
7. [Database Schema](#7-database-schema)
8. [API Design](#8-api-design)
9. [Screens](#9-screens)
10. [Design System](#10-design-system)
11. [Revenue Model](#11-revenue-model)
12. [GTM Strategy](#12-gtm-strategy)
13. [Post-MVP: Auto-Submit Strategy](#13-post-mvp-auto-submit-strategy)

---

## §1 Product Vision

Job searching is broken in a specific, painful way: the work is repetitive but not automatable by the person doing it. Every job posting requires reading the description, deciding if it's a fit, tailoring a resume, writing a cover letter, filling out the same form fields, and tracking the outcome. A motivated job seeker manages 5-10 quality applications per week. The math doesn't work — the best roles receive hundreds of applications within 48 hours, and the person who applies on day five with a generic resume loses to the person who applied on day one with a tailored one.

Woodhouse is a personal AI-powered recruiting agent. It continuously discovers job postings across multiple sources, evaluates each one against the user's verified professional profile, generates tailored application materials, and queues everything for human review. The user approves and submits. The system handles everything else.

The unique insight: existing job tools optimize the wrong side of the equation. Job boards help companies find candidates. LinkedIn helps recruiters search. Woodhouse flips this — it gives the job seeker their own AI recruiter that works 24/7, scanning hundreds of postings and preparing personalized applications at a pace no human could match.

**What Woodhouse is:** A private AI job search agent that finds, evaluates, and prepares job applications on your behalf.

**What Woodhouse is not:** A job board. A resume builder. A networking tool. An applicant tracking system for employers.

**Success at 6 months:** 10,000 active users, with power users submitting 20+ tailored applications per week. Average match score accuracy validated by user feedback (users agree with 80%+ of the system's evaluations).

**Success at 1 year:** 50,000 active users. Auto-submit launched for major ATS platforms. Users report 3x increase in interview callbacks compared to manual applications.

**Success at 3 years:** The default way professionals manage job searches. Expanded into career intelligence — salary benchmarking, skill gap analysis, career path recommendations.

---

## §2 User Personas

### Sarah Chen — Primary Persona
**Senior Software Engineer, 7 years experience, currently employed but exploring**

Sarah's current process: She checks LinkedIn twice a week, skims a few postings, opens two or three that look interesting, spends 45 minutes tailoring her resume for one, gets distracted, and closes the tab. She submits maybe 2 applications per week — both slightly rushed. She has a spreadsheet tracking where she's applied but forgets to update it.

With Woodhouse: Sarah sets up her profile once, defining her skills, experience, and what she's looking for. Woodhouse scans hundreds of postings daily, surfaces the 10-15 that genuinely match her background, and has tailored resumes and cover letters waiting when she opens the dashboard. She reviews five applications over coffee, approves three, and submits them before work. Her tracker updates automatically. She's applying to 15-20 well-matched roles per week without the grind.

### Marcus Williams — Career Changer
**Marketing Manager transitioning to Product Management, 5 years experience**

Marcus struggles most with the evaluation step. He reads PM job descriptions and can't tell if his marketing experience qualifies. He wastes time applying to roles that are too senior or too technical, and misses roles where his background is actually a strong fit.

With Woodhouse: The evaluation engine breaks down exactly how his experience maps to each role — which skills transfer, where the gaps are, and which roles value his marketing-to-PM trajectory. He stops wasting time on mismatches and focuses on the roles where he has a real shot.

### Priya Sharma — High-Volume Applicant
**Recent bootcamp graduate, actively job searching full-time**

Priya applies to everything she can find. She sends the same resume everywhere. Her response rate is under 3%. She doesn't know which version of her resume works best or which types of roles respond most.

With Woodhouse: Every application gets a tailored resume that highlights the specific technologies and projects relevant to that posting. The tracking system shows her which resume strategies generate interviews. Her response rate improves because every application is optimized, not generic.

### David Okafor — Executive Passive Seeker
**VP of Engineering, 15 years experience, very selective**

David isn't actively searching but wants to know when a truly exceptional opportunity appears. He doesn't want to browse job boards. He wants to be notified only when something matches his very specific criteria — VP/CTO roles, Series B+, specific tech stacks, certain metro areas.

With Woodhouse: He configures tight search criteria and a high match threshold (90+). Woodhouse runs silently in the background and pings him maybe once or twice a week with a role worth considering. Each comes with a pre-tailored resume and a clear breakdown of why the system thinks it's a fit.

**Primary target:** Sarah Chen — the employed professional who wants to explore opportunities but doesn't have the time for manual job searching. This is the largest segment and the highest willingness to pay.

---

## §3 Core User Flows

### Flow 1: Onboarding — Profile Setup

**Trigger:** New user signs up.

1. User lands on the sign-up page. Enters email and password. Clicks "Create Account."
2. Email verification sent. User clicks the link. Redirected to onboarding.
3. **Step 1 — Basic Info:** Form with fields: full name, phone (optional), country, location (city/region), LinkedIn URL (optional), portfolio URL (optional), GitHub URL (optional). User fills in and clicks "Continue."
4. **Step 2 — Professional Headline:** Single field: "How would you describe your role?" (e.g., "Senior Software Engineer"). Below it, a textarea for professional summary (2-3 sentences). AI assist button available: "Help me write this" — generates a summary from what the user has entered so far. User clicks "Continue."
5. **Step 3 — Work Experience:** User adds work experience entries one at a time. Each entry: company name, job title, location, country, start date, end date (or "I currently work here" toggle), description. For each entry, user adds achievement bullets. AI assist available: "Improve this bullet" — rewrites for impact and clarity. User can add multiple entries. Clicks "Continue" when done.
6. **Step 4 — Education:** User adds education entries. Each: institution, degree, field of study, start/end dates, GPA (optional), achievements/honors. Clicks "Continue."
7. **Step 5 — Skills:** User adds skills. Each skill has a name, category (technical, soft, language, certification, tool, framework), proficiency level (beginner through expert), and years of experience. AI assist: "Suggest skills from my experience" — analyzes work history and suggests skills to add. Clicks "Continue."
8. **Step 6 — Projects & Certifications (optional):** User adds portfolio projects and certifications. Clicks "Continue."
9. **Step 7 — Job Search Preferences:** Form with: target role titles (multi-select/free text), target countries (multi-select), target locations (multi-select), remote preference (remote only, hybrid, onsite, flexible), salary range, salary currency (dropdown, default based on user's country), job types (full-time, part-time, contract), preferred industries, preferred company sizes, keywords to search for, keywords to exclude, companies to exclude. Match threshold slider (default 70%). Clicks "Continue."
10. **Step 8 — Resume Upload (optional):** User can upload an existing resume (PDF or DOCX). The system parses it and pre-fills any missing profile fields. User reviews and confirms extracted data.
11. **Onboarding complete.** User sees dashboard with a message: "Woodhouse is now scanning for jobs matching your profile. You'll see results within the next few hours."

**Edge cases:**
- User abandons onboarding midway: progress is saved. They can resume from where they left off.
- Resume upload parsing fails: user is notified and asked to enter data manually.
- User has no work experience (new grad): work experience step shows a "No work experience yet" option that adjusts the profile accordingly.

---

### Flow 2: Job Discovery (Automated)

**Trigger:** Scheduled discovery run (runs every 6 hours per user, configurable).

1. System checks user's search preferences: keywords, target roles, locations, excluded companies/keywords.
2. **Source: Aggregator APIs** — System queries Google Jobs (via SerpAPI) and JSearch with the user's keywords, location, and target countries. Results are normalized into the standard job posting format.
3. **Source: ATS Boards** — System checks tracked company career pages on Greenhouse and Lever. New postings matching keywords are captured.
4. **Source: Email Forwarding** — System checks for any forwarded job alert emails since the last run. Parses email content to extract job posting details.
5. Each discovered posting is deduplicated against existing postings (by source URL and external ID).
6. New postings are saved to the database with status "active."
7. For each new posting, a pipeline job is **enqueued** in the `pipeline_jobs` table with `step='pre_screen'`. The evaluation does not run inline — the `process-pipeline` worker picks it up asynchronously (see Flow 3).
8. Discovery run is logged: sources scanned, jobs found, new jobs.
9. As pipeline jobs complete and applications reach "ready" status, notifications are sent (in-app + optional email digest).

**Edge cases:**
- API rate limits hit: system backs off and resumes on next scheduled run. Partial results are saved.
- Duplicate posting from different sources: deduplicated by company name + job title + location similarity.
- Job posting has expired since discovery: marked as expired during evaluation.

---

### Flow 3: Job Evaluation (Pre-Screen + Full Evaluation)

**Trigger:** Pipeline job with `step='pre_screen'` is claimed by the worker.

**Stage 1 — Haiku Pre-Screen (fast, ~$0.001):**
1. Haiku checks the job posting against the user's profile for basic disqualifiers: title mismatch, country/location incompatibility, seniority mismatch, salary range mismatch.
2. If the job fails the pre-screen (obvious mismatch):
   - Pipeline job is marked as completed. **No evaluation record is created.** The pre-screen result is stored in `pipeline_jobs.output_data` for audit purposes. The job is invisible to the user — it never appears in their feed.
3. If the job passes the pre-screen:
   - A new pipeline job is enqueued with `step='evaluate'`.

**Stage 2 — Sonnet Full Evaluation (~$0.02):**
1. Evaluation Agent reads the full job description and the user's complete profile (work history, skills, achievements, education). The user's profile is sent using Anthropic's prompt caching (see §5).
2. Agent scores the job on five dimensions (each 0-100):
   - **Skill alignment:** How many required/preferred skills does the user have?
   - **Experience match:** Does the user's years of experience and depth match the role?
   - **Seniority fit:** Is the role's level (junior/mid/senior/lead) appropriate?
   - **Location compatibility:** Does the location match the user's preferences (including remote)?
   - **Technology overlap:** Do the user's known technologies match the posting's stack?
3. Agent calculates an overall weighted score (0-100).
4. Agent generates:
   - A recommendation label: strong_match, good_match, possible_match, weak_match, no_match
   - A reasoning paragraph explaining the score
   - A list of strengths (why the user is a good fit)
   - A list of gaps (where the user may fall short)
5. Output is validated against `EvaluationSchema` (Zod). If validation fails, the pipeline job retries with exponential backoff.
6. If the overall score meets or exceeds the user's match threshold:
   - Evaluation is saved with `passes_threshold = true`
   - Application record is created with status "draft"
   - Pipeline job enqueued with `step='tailor'` (Flow 4)
7. If the score is below threshold:
   - Evaluation is saved with `passes_threshold = false`
   - Job appears in the "Below Threshold" section of the dashboard (user can still manually approve)
8. User can view the full evaluation breakdown for any job from the dashboard.

**Edge cases:**
- Job description is too vague to score meaningfully: agent flags this in reasoning and assigns a conservative score.
- Job is clearly a scam or spam: agent flags it and skips evaluation (pre-screen catches most of these).
- User manually overrides threshold for a specific job: application is created regardless of score, pipeline jobs enqueued for tailoring.

---

### Flow 4: Resume Tailoring & Material Generation

**Trigger:** Job passes evaluation threshold (or user manually triggers for a below-threshold job).

1. Tailoring Agent reads:
   - The full job description
   - The evaluation (strengths and gaps)
   - The user's complete knowledge base (all work experience, achievements, skills, projects, education)
2. Agent generates a tailored resume by:
   - Selecting the most relevant work experience entries
   - Reordering achievement bullets to prioritize those matching the job's requirements
   - Adjusting phrasing to incorporate keywords from the job description
   - Emphasizing technologies and skills mentioned in the posting
   - Selecting relevant projects to include
   - **Never inventing experience, companies, achievements, or metrics that don't exist in the knowledge base**
3. Tailored resume is saved as structured JSON and markdown.
4. Materials Agent generates:
   - **Cover letter** (optional, user-configurable): Personalized to the role, referencing specific aspects of the company and how the user's experience maps to the requirements.
   - **Standard application answers:** Pre-filled answers to common application questions (years of experience, work authorization, salary expectations, technical stack familiarity, etc.) — all grounded in verified profile data.
5. All materials are attached to the application record.
6. Application status updated from "draft" to "ready."
7. Application appears in the user's Review Queue.

**Edge cases:**
- Knowledge base is thin (new user with minimal experience entered): agent works with what's available, flags to the user that adding more detail would improve tailoring.
- Job requires cover letter but user has disabled cover letter generation: field is left empty, user is prompted to write one or enable generation.
- Tailoring would require fabricating experience to be competitive: agent notes this in the tailoring notes and works only with verified data.

---

### Flow 5: Review & Approval

**Trigger:** User opens the Review Queue (from dashboard or notification).

1. User sees a list of prepared applications, sorted by match score (highest first). Each card shows: company name, role title, match score badge, time since prepared.
2. User clicks an application to expand it.
3. Expanded view shows:
   - **Job Details panel:** Company, role, location, salary range, key requirements, application link.
   - **Evaluation panel:** Overall score, dimension scores, strengths, gaps, reasoning.
   - **Resume Preview:** The tailored resume rendered as it would appear in the final document. User can toggle between viewing the tailored version and their base resume to see what changed.
   - **Cover Letter Preview:** If generated. Editable inline.
   - **Application Answers:** Pre-filled answers. Each editable inline.
4. User can:
   - **Approve:** Marks the application as approved. System generates the final resume file (DOCX and PDF). Opens the application URL in a new tab. Copies relevant data to clipboard (or shows a "copy" button next to each field).
   - **Edit & Approve:** Make inline changes to any material, then approve.
   - **Skip:** Removes from queue. Application status set to "skipped." Won't reappear.
   - **Save for Later:** Keeps in queue but moves to a "Saved" section.
5. After approval, application status becomes "submitted" (user confirms they've submitted it externally).
6. Application moves to the Tracker.

**Edge cases:**
- Application URL is no longer valid (posting removed): user is notified. Application can still be saved for reference.
- User edits the tailored resume: changes are saved to the resume version but do NOT modify the knowledge base (the knowledge base is the source of truth).

---

### Flow 6: Application Tracking

**Trigger:** User visits the Tracker, or an application status changes.

1. Tracker displays all submitted applications in a kanban-style board with columns: Submitted, Acknowledged, Screening, Interviewing, Offer, Accepted, Rejected, Withdrawn.
2. Each card shows: company, role, date submitted, days since last update.
3. User clicks a card to see full details: all materials sent, the evaluation, a timeline of events, and notes.
4. User manually updates status as they hear back (e.g., "Got a phone screen scheduled for Tuesday").
5. User can add notes and set reminders for follow-ups.
6. Dashboard shows aggregate stats: total applications, response rate, interview rate, offers, average time to response.

**Edge cases:**
- User forgets to update status: system sends a gentle reminder after 14 days of no update on a "Submitted" application ("Any updates on your application to [Company]?").
- Company ghosts the user: after 30 days with no update, application is suggested for "Withdrawn" status.

---

### Flow 7: Manual Job Addition

**Trigger:** User finds a job posting outside of Woodhouse and wants to use the tailoring pipeline.

1. User clicks "Add Job" from the dashboard.
2. User pastes the job posting URL.
3. System fetches and parses the page content, extracting: title, company, location, description, requirements, application link.
4. User reviews the extracted data and corrects any parsing errors.
5. Job is saved and immediately sent through the Evaluation → Tailoring pipeline (Flows 3 and 4).
6. Application appears in the Review Queue once materials are generated.

**Edge cases:**
- URL is behind a login wall: system cannot access it. User is prompted to paste the job description text directly.
- Parsing extracts incorrect data: user corrects it in the review step before evaluation begins.

---

## §4 Feature Set

### Launch Features (MVP)

**Job Discovery**
- Automated job scanning via aggregator APIs (Google Jobs via SerpAPI, JSearch) — runs on a configurable schedule per user.
- ATS board monitoring for Greenhouse and Lever career pages.
- Email forwarding: users forward job alert emails to a unique inbox address; system parses and ingests postings.
- Manual job URL input with automatic parsing.
- Deduplication across all sources.
- Configurable search preferences: keywords, locations, remote preference, excluded companies, excluded keywords, salary range, job types, industries, company sizes.

**Job Evaluation**
- AI-powered match scoring on five dimensions: skill alignment, experience match, seniority fit, location compatibility, technology overlap.
- Configurable match threshold per user.
- Detailed evaluation breakdown with strengths, gaps, and reasoning.
- Manual override: users can force-evaluate or force-approve below-threshold jobs.

**Resume Knowledge Base**
- Structured profile: work history, achievements, education, skills, projects, certifications.
- AI-assisted profile building: bullet improvement, skill suggestion, summary generation.
- Optional resume upload with parsing to pre-fill profile.
- Knowledge base is the single source of truth — no fabrication.

**Resume Tailoring**
- Per-job tailored resumes generated from the knowledge base.
- Keyword optimization matching the job description.
- Achievement reordering and emphasis based on relevance.
- Output in DOCX and PDF formats.
- Side-by-side diff view: tailored vs. base resume.

**Application Materials**
- AI-generated cover letters personalized to each role.
- Pre-filled standard application answers grounded in profile data.
- Inline editing of all generated materials before approval.

**Review Queue**
- List of prepared applications sorted by match score.
- Expand to view full job details, evaluation, resume preview, cover letter, and answers.
- Actions: Approve, Edit & Approve, Skip, Save for Later.
- On approval: generates final resume files, opens application URL, provides copy-to-clipboard for form fields.

**Application Tracker**
- Kanban board: Submitted → Acknowledged → Screening → Interviewing → Offer → Accepted / Rejected / Withdrawn.
- Timeline of events per application.
- Notes and follow-up reminders.
- Aggregate statistics: response rate, interview rate, time to response.

**Notifications**
- In-app notifications for new matched jobs and prepared applications.
- Optional email digest (daily or weekly) summarizing new matches and queue status.

**Settings**
- Profile management (all knowledge base fields).
- Search preference configuration.
- Notification preferences.
- Account management (email, password).
- Subscription management.

### Explicitly Not in MVP

- **Auto-submit:** MVP is open-link-and-copy. Auto-submit is Phase 2 (see §13).
- **LinkedIn integration:** No LinkedIn API integration at launch (API access is restricted).
- **Interview preparation:** No mock interviews or prep materials.
- **Salary negotiation:** No negotiation tools or salary benchmarking.
- **Team/enterprise features:** No shared accounts or team dashboards.
- **Mobile app:** Web only. Responsive design for mobile browsers.
- **Browser extension:** No extension for scraping jobs from other sites.
- **AI chat interface:** No conversational interface. All interactions are through structured UI.

### Post-MVP Roadmap

- **Phase 2:** Auto-submit for major ATS platforms (see §13). Evaluate Trigger.dev migration when Edge Function timeouts or concurrency limits become bottlenecks.
- **Phase 2.5:** Cost optimizations at scale — Anthropic Batch API for non-urgent tailoring/materials (40-50% discount), source efficiency tuning (reduce scan frequency for low-match sources), prompt optimization for token reduction.
- **Phase 3:** Analytics, optimization, and quality — which resume versions generate interviews, which roles respond most, A/B testing resume strategies. Add evaluator-optimizer pattern for semantic truthfulness validation (a reviewer LLM pass that verifies tailored resume content accurately represents source material, beyond structural `source_id` tracing). This is also the point where agentic patterns may become justified — a "strategy agent" that learns from application outcomes.
- **Phase 4:** Career intelligence — skill gap analysis, career path recommendations, salary benchmarking.
- **Phase 5:** Browser extension for one-click job capture from any site.
- **Phase 6:** Interview preparation — AI mock interviews based on the specific role and company.

---

## §5 AI Agent Architecture

Woodhouse uses a pipeline of specialized AI agents, each responsible for a discrete step in the job application workflow. This is a **workflow architecture, not an agent architecture** — the steps are always Find → Evaluate → Tailor → Generate → Queue. The LLM provides intelligence within each step, but the control flow is predefined in code.

Agents are implemented as Supabase Edge Functions that call the Anthropic API (Claude) directly via the TypeScript SDK — no agent framework. Orchestration is handled by a `pipeline_jobs` queue table in Postgres with a worker Edge Function that claims and processes jobs on a 30-second cycle.

### Agent Overview

| Agent | Role | Trigger | Input | Output |
|-------|------|---------|-------|--------|
| Discovery Agent | Find and normalize job postings | Scheduled (cron) | Search preferences, source configs | Normalized job postings |
| Evaluation Agent | Score job fit | New posting discovered | Job posting + user profile | Match scores, reasoning, recommendation |
| Tailoring Agent | Generate customized resume | Job passes threshold | Job posting + evaluation + knowledge base | Tailored resume (JSON + markdown) |
| Materials Agent | Generate cover letter + answers | After tailoring | Job posting + evaluation + knowledge base + tailored resume | Cover letter, application answers |
| Orchestrator | Manage pipeline execution | Discovery run trigger | Pipeline state | Status updates, error handling |

### Agent Design Principles

1. **Single responsibility:** Each agent does one thing well. The Evaluation Agent only evaluates. It does not tailor resumes. The Tailoring Agent does not decide which jobs to apply to.

2. **Stateless execution:** Agents read all context from the database at invocation time. They do not maintain state between runs. This makes them idempotent and retryable.

3. **Structured output with Zod validation:** Every agent returns structured JSON, not free-form text. Every LLM response is validated against a Zod schema before being written to the database. If `safeParse` fails, the pipeline job is marked as failed and retried with a clearer prompt. Track validation failure rate as a key metric — target <1% in production.

```typescript
import { z } from 'zod';

const EvaluationSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  skill_score: z.number().int().min(0).max(100),
  experience_score: z.number().int().min(0).max(100),
  seniority_score: z.number().int().min(0).max(100),
  location_score: z.number().int().min(0).max(100),
  technology_score: z.number().int().min(0).max(100),
  recommendation: z.enum(['strong_match', 'good_match', 'possible_match', 'weak_match', 'no_match']),
  reasoning: z.string().min(50),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

// After Claude returns:
const parsed = EvaluationSchema.safeParse(JSON.parse(response.content[0].text));
if (!parsed.success) {
  throw new ValidationError(`Evaluation output invalid: ${parsed.error.message}`);
}
```

Equivalent Zod schemas must be defined for every agent output: `TailoredResumeSchema`, `MaterialsSchema`, `DiscoveryPostingSchema`.

4. **Truthfulness constraint:** The Tailoring and Materials agents operate under a hard constraint: they may only use information present in the user's knowledge base. This is enforced in the system prompt and validated post-generation.

5. **Graceful degradation:** If an agent fails (API timeout, malformed response, Zod validation failure), the pipeline marks that step as failed in the `pipeline_jobs` queue table and moves on. Failed items are retried with exponential backoff (30s → 60s → 120s) up to 3 attempts. Failed items do not block the pipeline for other jobs.

### Orchestrator — Queue-Backed Worker Pattern

The Orchestrator is not an AI agent — it is a pair of control functions backed by the `pipeline_jobs` queue table in Postgres. This is a classic **Blackboard pattern**: agents read from and write to a shared knowledge base (the database), and a controller manages the sequence.

**Two Edge Functions handle all orchestration:**

1. **`trigger-discoveries`** → **`discover-jobs`** — A `trigger-discoveries` Edge Function runs every hour via pg_cron. It queries all users where `search_preferences.next_discovery_at <= now()`, then invokes `discover-jobs` for each. The `discover-jobs` function creates a `discovery_run` record, invokes the Discovery Agent for each configured source (including `tracked_boards`) in parallel, deduplicates results, saves new postings, and **enqueues pre-screen jobs** in the `pipeline_jobs` table for each new posting. After completion, `next_discovery_at` is updated based on the user's subscription tier (free=+12h, pro=+6h, premium=+1h). Does NOT call the Evaluation Agent directly.

2. **`process-pipeline`** — Triggered by pg_cron every 30 seconds. Runs a **loop** that claims and processes jobs from the `pipeline_jobs` table using `SELECT FOR UPDATE SKIP LOCKED` until either: (a) no pending jobs remain, or (b) 120 seconds of the 150-second Edge Function timeout have elapsed. Each iteration claims one job, processes it, and enqueues the next step. This is the execution engine of the entire pipeline.

   **Throughput math:** If each LLM call takes ~10 seconds, the worker processes ~12 jobs per invocation. With invocations every 30 seconds (overlapping is safe due to `SKIP LOCKED`), throughput is ~1,400+ jobs/hour — sufficient for MVP scale (100 users × ~250 pipeline jobs per discovery cycle = ~25,000 jobs, cleared in ~18 hours across staggered user schedules).

**Pipeline job lifecycle:**
```
pending → processing → completed (enqueues next step)
                    → failed (if attempts >= max_attempts)
                    → pending (if attempts < max_attempts, with exponential backoff)
```

**Queue-based step sequencing:**
```
discover-jobs creates: pipeline_job(step='pre_screen', status='pending')
    → process-pipeline claims and runs Haiku pre-screen
    → IF fail: mark completed, no evaluation record (invisible to user)
    → IF pass: enqueue pipeline_job(step='evaluate')
        → process-pipeline claims and runs Sonnet evaluation
        → IF below threshold: save evaluation only (visible in dashboard)
        → IF passes_threshold: create application, enqueue pipeline_job(step='tailor')
            → process-pipeline claims and runs tailoring
            → enqueue pipeline_job(step='generate_materials')
                → process-pipeline claims and runs materials generation (Sonnet + Haiku)
                → enqueue pipeline_job(step='generate_files')
                    → process-pipeline claims and generates PDF/DOCX
                    → set application status='ready', create notification
```

**Concurrency control — `SELECT FOR UPDATE SKIP LOCKED`:**

pg_cron fires `process-pipeline` every 30 seconds. If a job takes 35 seconds, two invocations will overlap. Without `SKIP LOCKED`, both would attempt to process the same job, causing duplicate LLM calls and corrupted state.

```sql
-- Claim a single pending job atomically
WITH claimed AS (
  SELECT id FROM pipeline_jobs
  WHERE status = 'pending'
    AND attempts < max_attempts
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE pipeline_jobs SET
  status = 'processing',
  started_at = now(),
  attempts = attempts + 1
FROM claimed
WHERE pipeline_jobs.id = claimed.id
RETURNING pipeline_jobs.*;
```

This ensures no two Edge Function invocations process the same job, even under concurrent execution.

**Exponential backoff retry:**

On failure, the job is returned to `pending` with an exponential backoff delay:

```sql
UPDATE pipeline_jobs SET
  status = CASE
    WHEN attempts >= max_attempts THEN 'failed'
    ELSE 'pending'
  END,
  error = $error_message,
  next_retry_at = CASE
    WHEN attempts < max_attempts
    THEN now() + (interval '30 seconds' * power(2, attempts))
    ELSE NULL
  END
WHERE id = $job_id;
```

After 3 failures: 30s → 60s → 120s backoff, then permanently marked as `failed` with user notification.

**Zombie job detection:**

If `status = 'processing'` and `started_at < now() - interval '5 minutes'`, the job is a zombie (the Edge Function crashed or timed out without updating the record). The `process-pipeline` worker reclaims it by resetting status to `pending`.

**Error handling:**
- If a single job fails at any stage, it is logged in the `pipeline_jobs.error` field and retried with backoff. The pipeline continues for other jobs.
- If a source API is completely down, the discovery function logs the failure and continues with other sources.
- Each user's pipeline runs independently — jobs are scoped by `profile_id`.
- Tailoring and materials generation run sequentially per job (tailoring must complete before materials generation) — enforced by the step-based enqueue pattern.

### Discovery Agent — Detail

**System prompt context:**
- User's search preferences (keywords, locations, exclusions)
- Source configuration (API keys, board URLs)

**Tools available:**
- `search_google_jobs(query, location, country, radius)` — Calls SerpAPI Google Jobs endpoint
- `search_jsearch(query, location, country, job_type)` — Calls JSearch API on RapidAPI
- `scrape_greenhouse_board(board_url)` — Fetches and parses Greenhouse job board JSON
- `scrape_lever_board(board_url)` — Fetches and parses Lever job board JSON
- `parse_email_content(email_raw)` — Extracts job posting data from forwarded email HTML

**Output schema:**
```json
{
  "postings": [
    {
      "external_id": "string",
      "source": "google_jobs | jsearch | greenhouse | lever | email",
      "source_url": "string",
      "company_name": "string",
      "job_title": "string",
      "location": "string",
      "country": "string",
      "is_remote": "boolean",
      "job_type": "full_time | part_time | contract | freelance | internship",
      "experience_level": "entry | mid | senior | lead | director | executive",
      "salary_min": "number | null",
      "salary_max": "number | null",
      "salary_currency": "string | null",
      "description_raw": "string",
      "required_skills": ["string"],
      "preferred_skills": ["string"],
      "responsibilities": ["string"],
      "application_url": "string",
      "posted_date": "ISO8601 | null"
    }
  ]
}
```

### Evaluation Agent — Detail

**System prompt context:**
- The full job posting (structured)
- The user's complete profile: work history with achievements, skills with proficiency, education, projects, certifications
- Scoring rubric with dimension definitions and weight guidelines

**Scoring rubric:**

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Skill alignment | 30% | Percentage of required skills the user possesses, weighted by proficiency |
| Experience match | 25% | Years of experience vs. requirement, depth of relevant experience |
| Seniority fit | 15% | Role level vs. user's career level |
| Location compatibility | 15% | Location match, remote compatibility |
| Technology overlap | 15% | Specific tech stack match |

**Output schema:**
```json
{
  "overall_score": 82,
  "skill_score": 85,
  "experience_score": 90,
  "seniority_score": 75,
  "location_score": 100,
  "country_compatible": true,
  "technology_score": 70,
  "recommendation": "strong_match",
  "reasoning": "string — 2-3 paragraph explanation",
  "strengths": ["string"],
  "gaps": ["string"]
}
```

### Tailoring Agent — Detail

**System prompt context:**
- The full job posting
- The evaluation results (strengths and gaps)
- The user's complete knowledge base
- Hard constraint: "You may ONLY use information present in the user's profile. Do not invent, fabricate, or embellish any experience, company, achievement, metric, or skill. You may rephrase, reorder, and emphasize — but every fact must trace back to a specific entry in the knowledge base."

**Tailoring operations (permitted):**
- Reorder work experience entries to lead with most relevant
- Reorder achievement bullets within an experience entry
- Rephrase bullets to incorporate keywords from the job description
- Select which skills to highlight in a skills section
- Select which projects to include
- Adjust the professional summary to speak to this specific role
- Emphasize metrics and achievements that align with the posting

**Tailoring operations (forbidden):**
- Adding experience at a company not in the knowledge base
- Inventing metrics or achievements
- Claiming skills the user hasn't listed
- Inflating job titles or proficiency levels
- Adding certifications the user doesn't hold

**Output schema:**
```json
{
  "resume_content": {
    "header": {
      "full_name": "string",
      "headline": "string",
      "email": "string",
      "phone": "string",
      "location": "string",
      "linkedin_url": "string",
      "portfolio_url": "string"
    },
    "summary": "string — tailored professional summary",
    "work_experience": [
      {
        "source_id": "uuid — references knowledge base entry",
        "company_name": "string",
        "job_title": "string",
        "location": "string",
        "start_date": "string",
        "end_date": "string | Present",
        "achievements": [
          {
            "source_id": "uuid — references knowledge base achievement",
            "text": "string — potentially rephrased"
          }
        ]
      }
    ],
    "skills": ["string"],
    "education": [
      {
        "source_id": "uuid",
        "institution": "string",
        "degree": "string",
        "field_of_study": "string",
        "dates": "string"
      }
    ],
    "projects": [
      {
        "source_id": "uuid",
        "name": "string",
        "description": "string",
        "technologies": ["string"]
      }
    ],
    "certifications": [
      {
        "source_id": "uuid",
        "name": "string",
        "issuer": "string"
      }
    ]
  },
  "tailoring_notes": "string — explanation of what was changed and why",
  "content_markdown": "string — full resume in markdown format"
}
```

Every item includes a `source_id` tracing back to the knowledge base entry it was derived from. This enables the UI to show the diff between the tailored and base resume, and ensures auditability of the truthfulness constraint.

### Materials Agent — Detail

The Materials Agent makes **two LLM calls** — one Sonnet call for quality writing, one Haiku call for data extraction:

**Call 1 — Sonnet: Cover letter + "Why interested" answer**

System prompt context:
- The full job posting
- The evaluation results (strengths, gaps, reasoning)
- The tailored resume (so the cover letter complements rather than repeats)

Cover letter generation rules:
- 3-4 paragraphs maximum
- First paragraph: why this company/role specifically (not generic)
- Middle paragraphs: 2-3 specific examples from the user's experience that map to the role's key requirements
- Final paragraph: call to action, availability
- Tone: professional but not stiff, confident but not arrogant
- Must reference specific details from the job posting (not a template letter)

The "Why are you interested in this role?" answer is generated in the same call as the cover letter — it draws from the same context (evaluation strengths + job posting specifics) and requires the same quality of writing.

**Call 2 — Haiku: Extraction-based application answers**

System prompt context:
- The user's profile data (work history, skills, preferences)

These are simple lookups and calculations, not writing:

| Question | Source | Model |
|----------|--------|-------|
| Years of relevant experience | Calculated from work history | Haiku |
| Work authorization | From profile | Haiku |
| Salary expectations | From profile preferences | Haiku |
| Willing to relocate | Derived from location preferences | Haiku |
| Technical proficiency in [X] | From skills with proficiency level | Haiku |
| When can you start? | Default: "2 weeks notice" unless user specifies | Haiku |
| Why are you interested in this role? | Generated from evaluation strengths | **Sonnet** (Call 1) |

**Combined output schema:**
```json
{
  "cover_letter": "string — full cover letter text",
  "why_interested": "string — answer to 'Why are you interested in this role?'",
  "application_answers": [
    {
      "question": "string",
      "answer": "string",
      "source": "string — where this data came from in the profile"
    }
  ]
}
```

### Agent Execution Environment

All agents run as **Supabase Edge Functions** (Deno runtime).

**Why Supabase Edge Functions over Next.js API routes:**
- 150-second execution timeout (vs. 10s on Vercel Hobby, 60s on Vercel Pro)
- Direct access to Supabase database without network hop
- Can run background/scheduled work via pg_cron triggers
- Isolates AI workload from the user-facing web app

**API call pattern:**
```
Edge Function → Anthropic API (Claude Sonnet for evaluation/tailoring, Haiku for parsing/normalization)
```

**Model routing:**

| Task | Model | Reasoning | Est. Cost per Call |
|------|-------|-----------|-------------------|
| Job description parsing | Haiku 4.5 | Structured extraction, no reasoning needed | ~$0.001 |
| Email parsing | Haiku 4.5 | Structured extraction | ~$0.001 |
| Evaluation pre-screen | Haiku 4.5 | Quick title/country/location/seniority gate | ~$0.001 |
| Full evaluation | Sonnet 4.6 | Requires reasoning, scoring, explanation | ~$0.01-0.03 |
| Resume tailoring | Sonnet 4.6 | Requires reasoning, writing quality | ~$0.02-0.05 |
| Cover letter generation | Sonnet 4.6 | Requires quality writing | ~$0.01-0.03 |
| Application answers | Haiku 4.5 | Simple extraction from profile data | ~$0.002 |
| Achievement improvement (AI assist) | Sonnet 4.6 | Writing quality matters | ~$0.005 |
| Skill suggestion (AI assist) | Haiku 4.5 | Simple analysis | ~$0.002 |

**Two-stage evaluation (Haiku pre-screen):**

Before sending to Sonnet (~$0.02/eval), every job runs through a quick Haiku pre-screen (~$0.001) that checks basic disqualifiers: title mismatch, country/location incompatibility, seniority mismatch, salary range mismatch. Only jobs passing the pre-screen proceed to full Sonnet evaluation. This cuts evaluation costs by 50-70% by filtering obviously bad matches before the expensive call.

```
Haiku pre-screen (fast, $0.001) → PASS → Sonnet full evaluation ($0.02)
                                → FAIL → Save as no_match, skip pipeline
```

**Cost management:**

1. **Anthropic prompt caching (Day 1 requirement):** The user's full profile (~3,000 tokens) is identical across every evaluation in a single discovery run. Using Anthropic's `cache_control` parameter, the profile is sent at full cost once and cached at ~10% cost for all subsequent evaluations in the run. Evaluating 20 jobs costs: 1 full profile send + 19 cached sends. **Estimated savings: 58% reduction per evaluation run.**

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  system: [
    {
      type: 'text',
      text: EVALUATION_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' }
    },
    {
      type: 'text',
      text: formatUserProfile(profile),
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: [{
    role: 'user',
    content: formatJobPosting(posting)  // This changes per job
  }]
});
```

2. **Database-level deduplication:** If a job posting hasn't changed (content hash match) and the user's profile hasn't changed, don't re-evaluate. Enforced by `UNIQUE(profile_id, job_posting_id)` on `job_evaluations`.

3. **Source efficiency:** If a user's match rate from a particular source is <5% over 30 days, reduce scan frequency for that source.

4. **Post-MVP: Anthropic Batch API** for non-urgent tailoring/materials at 40-50% discount (Phase 2 optimization).

---

## §6 Technical Architecture

### Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14+ (App Router) | Server components, server actions, file-based routing. Industry standard for React apps on Vercel. |
| Styling | Tailwind CSS 3+ | Utility-first, rapid UI development, consistent design system implementation. |
| UI Components | shadcn/ui | High-quality, accessible, customizable components built on Radix UI. Not a dependency — components are copied into the project. |
| Backend/Database | Supabase (PostgreSQL) | Auth, database, storage, edge functions, realtime — single platform for all backend needs. |
| Auth | Supabase Auth | Email/password authentication. Integrated with RLS for row-level security. |
| AI | Anthropic API (Claude) | Sonnet 4.6 for reasoning tasks, Haiku 4.5 for parsing tasks. |
| File Storage | Supabase Storage | Generated resume files (PDF, DOCX). |
| Resume Generation | `docx` (npm) for DOCX, `@react-pdf/renderer` for PDF | Serverless-compatible document generation without browser dependencies. |
| Job API | SerpAPI (Google Jobs), JSearch (RapidAPI) | Broad job posting coverage across sources. |
| Email Ingestion | SendGrid Inbound Parse (or Resend) | Webhook-based email receiving for forwarded job alerts. |
| Payments | Stripe | Subscription billing, customer portal, webhook-based status sync. |
| Hosting | Vercel | Optimized for Next.js. Automatic deployments, edge network, analytics. |
| Cron/Scheduling | Supabase pg_cron + Vercel Cron | pg_cron for database-triggered jobs, Vercel Cron for HTTP-triggered schedules. |
| LLM Observability | Langfuse | Per-agent cost tracking, latency percentiles, error rates, token usage. Open-source, self-hostable or cloud. |
| Error Tracking | Sentry | Runtime error tracking with context (function name, step, user ID, job posting ID). |
| Schema Validation | Zod | Runtime validation of all LLM responses before database writes. |

### Architecture Diagram (Conceptual)

```
┌──────────────────────────────────────────────────────────────┐
│                          VERCEL                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Next.js App (App Router)                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │  │
│  │  │  Pages/   │ │  Server  │ │     API Routes         │ │  │
│  │  │  Layouts  │ │  Actions │ │ (Stripe/Email webhooks)│ │  │
│  │  └──────────┘ └──────────┘ └────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                         SUPABASE                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Postgres (DB)                          │ │
│  │  ┌────────────────┐  ┌────────────┐  ┌───────────────┐  │ │
│  │  │ pipeline_jobs  │  │  profiles,  │  │ discovery_runs│  │ │
│  │  │ (queue table)  │  │  postings,  │  │ tracked_boards│  │ │
│  │  │                │  │  evals,     │  │               │  │ │
│  │  │ pending →      │  │  apps,      │  │               │  │ │
│  │  │ processing →   │  │  resumes    │  │               │  │ │
│  │  │ completed      │  │             │  │               │  │ │
│  │  └───────┬────────┘  └─────────────┘  └───────────────┘  │ │
│  │          │                                                 │ │
│  │  ┌───────┴────────┐                                       │ │
│  │  │    pg_cron      │                                      │ │
│  │  │ • Every 30s:    │                                      │ │
│  │  │   process-      │                                      │ │
│  │  │   pipeline      │                                      │ │
│  │  │ • Every 1h:     │                                      │ │
│  │  │   trigger-      │                                      │ │
│  │  │   discoveries   │                                      │ │
│  │  └───────┬────────┘                                       │ │
│  └──────────┼────────────────────────────────────────────────┘ │
│             ▼                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Edge Functions (Deno)                        │ │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │ │
│  │  │  discover-jobs   │  │  process-pipeline (worker)   │  │ │
│  │  │  Fetches APIs,   │  │  Loop: claim → process →     │  │ │
│  │  │  enqueues        │  │  enqueue next step            │  │ │
│  │  │  pre_screen jobs │  │  (until 120s or queue empty)  │  │ │
│  │  └─────────────────┘  └──────────────────────────────┘  │ │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │ │
│  │  │  generate-files  │  │  parse-job-url               │  │ │
│  │  │  PDF + DOCX      │  │  Manual job parsing          │  │ │
│  │  └─────────────────┘  └──────────────────────────────┘  │ │
│  └───────────┬──────────────────────┬───────────────────────┘ │
│              │                      │                          │
│  ┌───────────┘  ┌──────────┐       │                          │
│  │  │ Realtime │  │ Storage  │       │                          │
│  │  │ (push to │  │ (resume  │       │                          │
│  │  │  client) │  │  files)  │       │                          │
│  │  └──────────┘  └──────────┘       │                          │
│  ┌──────────┐                        │                          │
│  │   Auth   │                        │                          │
│  └──────────┘                        │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
             ┌──────────┐     ┌──────────────┐    ┌──────────┐
             │ Anthropic│     │  External    │    │ Langfuse │
             │   API    │     │  Job APIs    │    │  (LLM    │
             │ (Claude) │     │ SerpAPI,     │    │  observ- │
             │          │     │ JSearch      │    │  ability)│
             └──────────┘     └──────────────┘    └──────────┘
```

### Key Architectural Decisions

**Server Components by default.** All pages use React Server Components unless client-side interactivity is required. This minimizes client bundle size and keeps data fetching on the server.

**Supabase client usage:**
- **Server-side (Server Components, Server Actions, API Routes):** Use `createServerClient` from `@supabase/ssr` with cookie-based auth.
- **Client-side (Client Components):** Use `createBrowserClient` from `@supabase/ssr` for realtime subscriptions and optimistic updates only.
- **Edge Functions:** Use `createClient` from `@supabase/supabase-js` with the service role key for admin-level access.

**Row Level Security (RLS):** Every table has RLS enabled. Users can only read/write their own data. Edge Functions use the service role key to bypass RLS when operating on behalf of users (e.g., writing discovery results).

**AI calls are server-side only.** The Anthropic API key is never exposed to the client. All AI operations happen in Supabase Edge Functions. The frontend never calls Claude directly.

**File generation happens in Edge Functions.** Resume PDF/DOCX files are generated in Supabase Edge Functions and uploaded to Supabase Storage. The frontend receives a signed URL to download the file.

**Email forwarding architecture:** Users receive a unique forwarding address (e.g., `jobs+{user_id_short}@inbound.woodhouse.app`). Emails sent to this address hit a SendGrid Inbound Parse webhook → Next.js API route → saved to database → triggers discovery pipeline for that email.

**Realtime for pipeline status:** The frontend subscribes to Supabase Realtime on the `applications` and `discovery_runs` tables. When the pipeline creates new evaluations or prepared applications, the dashboard updates without polling.

**LLM observability via Langfuse:** Every Anthropic API call is wrapped with a Langfuse trace. This provides per-agent cost analysis, error rates, latency percentiles, and token usage tracking — critical for validating that per-user API costs stay within tier margins.

```typescript
async function callAgent(agentType: string, input: any, userId: string) {
  const trace = langfuse.trace({ name: agentType, userId });
  const start = Date.now();
  try {
    const result = await executeAgent(agentType, input);
    trace.update({
      output: result,
      metadata: {
        duration_ms: Date.now() - start,
        input_tokens: result.usage?.input_tokens,
        output_tokens: result.usage?.output_tokens,
        model: result.model,
        cache_read_tokens: result.usage?.cache_read_input_tokens ?? 0,
        success: true,
      }
    });
    return result;
  } catch (error) {
    trace.update({ metadata: { success: false, error: error.message } });
    throw error;
  }
}
```

### Environment Variables

| Variable | Purpose | Where used |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (RLS-restricted) | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (bypasses RLS) | Edge Functions only |
| `ANTHROPIC_API_KEY` | Claude API access | Edge Functions only |
| `SERPAPI_API_KEY` | Google Jobs search | Edge Functions only |
| `JSEARCH_API_KEY` | JSearch (RapidAPI) | Edge Functions only |
| `STRIPE_SECRET_KEY` | Stripe billing | Server Actions / API Routes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | API Routes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side | Client |
| `SENDGRID_WEBHOOK_SECRET` | Email inbound verification | API Routes |
| `LANGFUSE_SECRET_KEY` | Langfuse LLM observability | Edge Functions only |
| `LANGFUSE_PUBLIC_KEY` | Langfuse project identifier | Edge Functions only |
| `LANGFUSE_BASE_URL` | Langfuse API endpoint (cloud or self-hosted) | Edge Functions only |
| `SENTRY_DSN` | Sentry error tracking | Server + Edge Functions |
| `NEXT_PUBLIC_APP_URL` | Application base URL | Client + Server |

**Never expose** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SERPAPI_API_KEY`, `JSEARCH_API_KEY`, `STRIPE_SECRET_KEY`, or `LANGFUSE_SECRET_KEY` to the client. These are server/edge-only.

---

## §7 Database Schema

All tables live in the `public` schema. Supabase Auth manages the `auth.users` table. RLS is enabled on every table.

### Profiles

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  country TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  github_url TEXT,
  headline TEXT,
  summary TEXT,
  target_roles TEXT[] DEFAULT '{}',
  target_locations TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  remote_preference TEXT DEFAULT 'flexible'
    CHECK (remote_preference IN ('remote_only', 'hybrid', 'onsite', 'flexible')),
  min_salary INTEGER,
  max_salary INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  experience_years INTEGER,
  work_authorization TEXT,
  match_threshold INTEGER DEFAULT 70 CHECK (match_threshold BETWEEN 0 AND 100),
  cover_letter_enabled BOOLEAN DEFAULT TRUE,
  email_digest TEXT DEFAULT 'daily'
    CHECK (email_digest IN ('none', 'daily', 'weekly')),
  forwarding_address TEXT UNIQUE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS: users can only access their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

### Work Experiences

```sql
CREATE TABLE public.work_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  location TEXT,
  country TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own work experiences"
  ON public.work_experiences FOR ALL USING (
    profile_id = auth.uid()
  );

CREATE INDEX idx_work_experiences_profile ON public.work_experiences(profile_id);
```

### Achievements

```sql
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_experience_id UUID NOT NULL REFERENCES public.work_experiences(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  metrics TEXT,
  skills TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own achievements"
  ON public.achievements FOR ALL USING (
    work_experience_id IN (
      SELECT id FROM public.work_experiences WHERE profile_id = auth.uid()
    )
  );

CREATE INDEX idx_achievements_work_experience ON public.achievements(work_experience_id);
```

### Education

```sql
CREATE TABLE public.education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  gpa NUMERIC(3,2),
  achievements TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own education"
  ON public.education FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_education_profile ON public.education(profile_id);
```

### Skills

```sql
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other'
    CHECK (category IN ('technical', 'soft', 'language', 'certification', 'tool', 'framework', 'other')),
  proficiency TEXT DEFAULT 'intermediate'
    CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own skills"
  ON public.skills FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_skills_profile ON public.skills(profile_id);
```

### Projects

```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  technologies TEXT[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  highlights TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_projects_profile ON public.projects(profile_id);
```

### Certifications

```sql
CREATE TABLE public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own certifications"
  ON public.certifications FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_certifications_profile ON public.certifications(profile_id);
```

### Search Preferences

```sql
CREATE TABLE public.search_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  excluded_keywords TEXT[] DEFAULT '{}',
  excluded_companies TEXT[] DEFAULT '{}',
  preferred_company_sizes TEXT[] DEFAULT '{}',
  preferred_industries TEXT[] DEFAULT '{}',
  min_salary INTEGER,
  max_salary INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  job_types TEXT[] DEFAULT ARRAY['full_time'],
  is_active BOOLEAN DEFAULT TRUE,
  next_discovery_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

-- Scan interval is NOT user-configurable. It is derived from the subscription tier:
-- free=12h, pro=6h, premium=1h. Enforced by the trigger-discoveries cron job.
-- next_discovery_at is updated after each discovery run:
--   next_discovery_at = now() + interval based on subscription.plan

ALTER TABLE public.search_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own search preferences"
  ON public.search_preferences FOR ALL USING (profile_id = auth.uid());
```

### Tracked Boards

Users can monitor specific company career pages on Greenhouse and Lever for new postings.

```sql
CREATE TABLE public.tracked_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('greenhouse', 'lever')),
  board_url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, board_url)
);

ALTER TABLE public.tracked_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tracked boards"
  ON public.tracked_boards FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_tracked_boards_profile ON public.tracked_boards(profile_id);
CREATE INDEX idx_tracked_boards_active ON public.tracked_boards(is_active) WHERE is_active = TRUE;
```

### Job Postings

```sql
CREATE TABLE public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('google_jobs', 'jsearch', 'greenhouse', 'lever', 'workday', 'manual', 'email', 'linkedin', 'indeed', 'other')),
  source_url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_logo_url TEXT,
  job_title TEXT NOT NULL,
  location TEXT,
  country TEXT,
  is_remote BOOLEAN DEFAULT FALSE,
  job_type TEXT
    CHECK (job_type IN ('full_time', 'part_time', 'contract', 'freelance', 'internship')),
  experience_level TEXT
    CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'director', 'executive')),
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  description_raw TEXT NOT NULL,
  description_structured JSONB,
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  responsibilities TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  application_url TEXT,
  application_method TEXT DEFAULT 'url'
    CHECK (application_method IN ('url', 'email', 'api', 'unknown')),
  posted_date TIMESTAMPTZ,
  expires_date TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'filled', 'removed')),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(source, external_id)
);

-- No RLS on job_postings — they are shared across users.
-- Access is controlled through joins with user-specific evaluations and applications.
-- Edge Functions write with service role key.

CREATE INDEX idx_job_postings_source ON public.job_postings(source);
CREATE INDEX idx_job_postings_status ON public.job_postings(status);
CREATE INDEX idx_job_postings_company ON public.job_postings(company_name);
CREATE INDEX idx_job_postings_discovered ON public.job_postings(discovered_at DESC);
```

### Job Evaluations

```sql
CREATE TABLE public.job_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  skill_score INTEGER CHECK (skill_score BETWEEN 0 AND 100),
  experience_score INTEGER CHECK (experience_score BETWEEN 0 AND 100),
  seniority_score INTEGER CHECK (seniority_score BETWEEN 0 AND 100),
  location_score INTEGER CHECK (location_score BETWEEN 0 AND 100),
  technology_score INTEGER CHECK (technology_score BETWEEN 0 AND 100),
  reasoning TEXT,
  strengths TEXT[] DEFAULT '{}',
  gaps TEXT[] DEFAULT '{}',
  recommendation TEXT
    CHECK (recommendation IN ('strong_match', 'good_match', 'possible_match', 'weak_match', 'no_match')),
  passes_threshold BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, job_posting_id)
);

ALTER TABLE public.job_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evaluations"
  ON public.job_evaluations FOR SELECT USING (profile_id = auth.uid());

CREATE INDEX idx_evaluations_profile ON public.job_evaluations(profile_id);
CREATE INDEX idx_evaluations_job ON public.job_evaluations(job_posting_id);
CREATE INDEX idx_evaluations_score ON public.job_evaluations(overall_score DESC);
```

### Applications

```sql
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  job_evaluation_id UUID REFERENCES public.job_evaluations(id),
  status TEXT DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'ready', 'approved', 'submitted', 'acknowledged',
      'screening', 'interviewing', 'offer', 'accepted', 'rejected',
      'withdrawn', 'skipped'
    )),
  cover_letter TEXT,
  application_answers JSONB DEFAULT '[]',
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  next_step TEXT,
  next_step_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, job_posting_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own applications"
  ON public.applications FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_applications_profile ON public.applications(profile_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_job ON public.applications(job_posting_id);
```

### Resume Versions

```sql
CREATE TABLE public.resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  job_posting_id UUID REFERENCES public.job_postings(id),
  content_json JSONB NOT NULL,
  content_markdown TEXT,
  file_url_pdf TEXT,
  file_url_docx TEXT,
  tailoring_notes TEXT,
  is_base BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own resume versions"
  ON public.resume_versions FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_resume_versions_profile ON public.resume_versions(profile_id);
CREATE INDEX idx_resume_versions_application ON public.resume_versions(application_id);
```

### Application Events

```sql
CREATE TABLE public.application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'materials_generated', 'approved', 'submitted',
      'response_received', 'interview_scheduled', 'interview_completed',
      'offer_received', 'accepted', 'rejected', 'withdrawn',
      'note_added', 'follow_up_sent', 'status_changed'
    )),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own application events"
  ON public.application_events FOR SELECT USING (
    application_id IN (
      SELECT id FROM public.applications WHERE profile_id = auth.uid()
    )
  );

CREATE INDEX idx_events_application ON public.application_events(application_id);
CREATE INDEX idx_events_created ON public.application_events(created_at DESC);
```

### Pipeline Jobs (Queue Table)

This is the backbone of the pipeline orchestration. Every unit of work in the pipeline is a row in this table.

```sql
CREATE TABLE public.pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  discovery_run_id UUID REFERENCES public.discovery_runs(id) ON DELETE SET NULL,
  step TEXT NOT NULL
    CHECK (step IN ('pre_screen', 'evaluate', 'tailor', 'generate_materials', 'generate_files')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  input_data JSONB,
  output_data JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- No RLS on pipeline_jobs — managed by Edge Functions with service role key.
-- Workers need to claim jobs across all users.

CREATE INDEX idx_pipeline_jobs_queue
  ON public.pipeline_jobs(status, next_retry_at, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_pipeline_jobs_profile ON public.pipeline_jobs(profile_id);
CREATE INDEX idx_pipeline_jobs_posting ON public.pipeline_jobs(job_posting_id);
CREATE INDEX idx_pipeline_jobs_status ON public.pipeline_jobs(status);

-- Index for zombie detection
CREATE INDEX idx_pipeline_jobs_zombie
  ON public.pipeline_jobs(status, started_at)
  WHERE status = 'processing';
```

### Discovery Runs

```sql
CREATE TABLE public.discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  sources_scanned TEXT[] DEFAULT '{}',
  jobs_found INTEGER DEFAULT 0,
  jobs_new INTEGER DEFAULT 0,
  jobs_matched INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own discovery runs"
  ON public.discovery_runs FOR SELECT USING (profile_id = auth.uid());

CREATE INDEX idx_discovery_runs_profile ON public.discovery_runs(profile_id);
CREATE INDEX idx_discovery_runs_status ON public.discovery_runs(status);
```

### Subscriptions

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'premium')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  applications_used INTEGER DEFAULT 0,
  applications_limit INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT USING (profile_id = auth.uid());

CREATE INDEX idx_subscriptions_profile ON public.subscriptions(profile_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_customer_id);
```

### Notifications

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN (
      'new_matches', 'applications_ready', 'follow_up_reminder',
      'status_stale', 'subscription_warning', 'system'
    )),
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_notifications_profile ON public.notifications(profile_id);
CREATE INDEX idx_notifications_unread ON public.notifications(profile_id, read) WHERE read = FALSE;
```

### Database Functions

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_experiences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.education
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.search_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tracked_boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Note: pipeline_jobs intentionally has no updated_at trigger —
-- status transitions are tracked via started_at, completed_at, and next_retry_at columns.

-- Auto-create profile and subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  -- Limits: free=5, pro=50, premium=200
  INSERT INTO public.subscriptions (profile_id, plan, applications_limit)
  VALUES (NEW.id, 'free', 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment applications_used when an application is approved
CREATE OR REPLACE FUNCTION public.handle_application_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.subscriptions
    SET applications_used = applications_used + 1
    WHERE profile_id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_approved
  AFTER INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_application_approved();

-- Claim next pending pipeline job atomically (used by process-pipeline Edge Function)
CREATE OR REPLACE FUNCTION public.claim_pipeline_job()
RETURNS SETOF public.pipeline_jobs AS $$
  WITH zombies_reclaimed AS (
    UPDATE public.pipeline_jobs SET
      status = 'pending',
      started_at = NULL
    WHERE status = 'processing'
      AND started_at < now() - interval '5 minutes'
    RETURNING id
  ),
  claimed AS (
    SELECT id FROM public.pipeline_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pipeline_jobs SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  FROM claimed
  WHERE public.pipeline_jobs.id = claimed.id
  RETURNING public.pipeline_jobs.*;
$$ LANGUAGE sql;

-- Mark pipeline job as failed with exponential backoff
CREATE OR REPLACE FUNCTION public.fail_pipeline_job(
  p_job_id UUID,
  p_error TEXT
)
RETURNS void AS $$
  UPDATE public.pipeline_jobs SET
    status = CASE
      WHEN attempts >= max_attempts THEN 'failed'
      ELSE 'pending'
    END,
    error = p_error,
    next_retry_at = CASE
      WHEN attempts < max_attempts
      THEN now() + (interval '30 seconds' * power(2, attempts))
      ELSE NULL
    END
  WHERE id = p_job_id;
$$ LANGUAGE sql;

-- Log application status changes
CREATE OR REPLACE FUNCTION public.handle_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.application_events (application_id, event_type, description)
    VALUES (NEW.id, 'status_changed', 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_status_change
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_application_status_change();
```

---

## §8 API Design

### Conventions

- All API routes are Next.js App Router route handlers (`app/api/...`) or Server Actions.
- Authentication: Supabase Auth session via cookies. Every authenticated request validates the session server-side.
- Error format: `{ "error": { "code": "string", "message": "string" } }`
- Success format: `{ "data": <response> }` or `{ "data": <response>, "meta": { "total": number, "page": number } }`
- Dates: ISO 8601 format.
- IDs: UUID v4.
- Pagination: `?page=1&limit=20` (default limit 20, max 100).

### Auth Endpoints

These are handled by Supabase Auth client library, not custom endpoints:
- `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- `supabase.auth.signInWithPassword({ email, password })`
- `supabase.auth.signOut()`
- `supabase.auth.resetPasswordForEmail(email)`

### Profile

**GET /api/profile**
- Auth: Required
- Response: Full profile object with nested work_experiences (with achievements), education, skills, projects, certifications, search_preferences
```json
{
  "data": {
    "id": "uuid",
    "email": "string",
    "full_name": "string",
    "phone": "string | null",
    "location": "string | null",
    "country": "string | null",
    "headline": "string | null",
    "summary": "string | null",
    "target_roles": ["string"],
    "target_countries": ["string"],
    "target_locations": ["string"],
    "remote_preference": "string",
    "min_salary": "number | null",
    "max_salary": "number | null",
    "salary_currency": "string",
    "experience_years": "number | null",
    "work_authorization": "string | null",
    "match_threshold": 70,
    "cover_letter_enabled": true,
    "onboarding_complete": false,
    "work_experiences": [...],
    "education": [...],
    "skills": [...],
    "projects": [...],
    "certifications": [...],
    "search_preferences": {...}
  }
}
```

**PATCH /api/profile**
- Auth: Required
- Body: Partial profile fields (top-level only)
- Response: Updated profile

### Work Experience (Server Actions)

These use Next.js Server Actions for simpler CRUD:

- `createWorkExperience(data)` → creates entry, returns it
- `updateWorkExperience(id, data)` → updates, returns it
- `deleteWorkExperience(id)` → deletes
- `reorderWorkExperiences(ids[])` → updates sort_order

### Achievements (Server Actions)

- `createAchievement(workExperienceId, data)` → creates
- `updateAchievement(id, data)` → updates
- `deleteAchievement(id)` → deletes
- `reorderAchievements(workExperienceId, ids[])` → updates sort_order
- `improveAchievement(id)` → calls AI to rewrite the bullet for impact, returns suggestion (does not auto-save)

### Education, Skills, Projects, Certifications (Server Actions)

Same CRUD pattern as work experience for each entity type.

### Search Preferences (Server Actions)

- `updateSearchPreferences(data)` → upserts, returns preferences

### Tracked Boards (Server Actions)

- `createTrackedBoard(data)` → creates entry (platform, board_url, company_name), returns it
- `deleteTrackedBoard(id)` → deletes
- `getTrackedBoards()` → returns all tracked boards for the user

### AI Assist (Server Actions)

- `generateSummary()` → AI generates professional summary from profile data
- `suggestSkills()` → AI analyzes work history and suggests skills to add
- `improveAchievement(achievementId)` → AI rewrites a single achievement bullet

### Job Postings

**GET /api/jobs**
- Auth: Required
- Query params: `?status=active&page=1&limit=20&sort=discovered_at&order=desc`
- Response: Paginated list of job postings with the user's evaluation (if exists)
```json
{
  "data": [
    {
      "id": "uuid",
      "company_name": "string",
      "job_title": "string",
      "location": "string",
      "country": "string",
      "is_remote": true,
      "source": "string",
      "posted_date": "ISO8601",
      "evaluation": {
        "overall_score": 85,
        "recommendation": "strong_match",
        "passes_threshold": true
      } | null
    }
  ],
  "meta": { "total": 142, "page": 1, "limit": 20 }
}
```

**GET /api/jobs/:id**
- Auth: Required
- Response: Full job posting with evaluation details

**POST /api/jobs/manual**
- Auth: Required
- Body: `{ "url": "string" }` or `{ "title": "string", "company": "string", "description": "string", ... }`
- Action: Fetches and parses the URL (if URL provided), creates job posting, triggers evaluation pipeline.
- Response: Created job posting
```json
{
  "data": {
    "id": "uuid",
    "job_title": "string",
    "company_name": "string",
    "status": "active",
    "pipeline_status": "evaluating"
  }
}
```

### Evaluations

**GET /api/evaluations**
- Auth: Required
- Query: `?passes_threshold=true&page=1&limit=20&sort=overall_score&order=desc`
- Response: Paginated evaluations with job posting summary

**GET /api/evaluations/:id**
- Auth: Required
- Response: Full evaluation with all dimension scores, reasoning, strengths, gaps

**POST /api/evaluations/:jobPostingId/override**
- Auth: Required
- Action: Force-creates an application for a below-threshold job
- Response: Created application

### Applications

**GET /api/applications**
- Auth: Required
- Query: `?status=ready&page=1&limit=20`
- Response: Paginated applications with job posting and evaluation summary

**GET /api/applications/:id**
- Auth: Required
- Response: Full application with job posting, evaluation, resume version, cover letter, answers

**PATCH /api/applications/:id**
- Auth: Required
- Body: Partial update (status, cover_letter, application_answers, notes, next_step, next_step_date)
- Response: Updated application

**POST /api/applications/:id/approve**
- Auth: Required
- Action: Sets status to "approved", generates final resume files (PDF + DOCX), returns download URLs
- Checks subscription limit before approving
- Response:
```json
{
  "data": {
    "id": "uuid",
    "status": "approved",
    "resume_pdf_url": "string (signed URL)",
    "resume_docx_url": "string (signed URL)",
    "application_url": "string",
    "cover_letter": "string",
    "application_answers": [...]
  }
}
```

**POST /api/applications/:id/submit**
- Auth: Required
- Action: Marks application as "submitted", logs event with timestamp
- Response: Updated application

**POST /api/applications/:id/skip**
- Auth: Required
- Action: Sets status to "skipped"

### Resume Versions

**GET /api/resumes/:applicationId**
- Auth: Required
- Response: Resume version with content_json, content_markdown, tailoring_notes, file URLs

**GET /api/resumes/:applicationId/diff**
- Auth: Required
- Response: Side-by-side comparison of tailored resume vs. base profile data

### Application Events

**GET /api/applications/:id/events**
- Auth: Required
- Response: Chronological list of events for the application

**POST /api/applications/:id/events**
- Auth: Required
- Body: `{ "event_type": "note_added", "description": "string" }`
- Response: Created event

### Dashboard

**GET /api/dashboard**
- Auth: Required
- Response: Aggregated dashboard data
```json
{
  "data": {
    "queue_count": 12,
    "applications_this_period": 3,
    "applications_limit": 5,
    "total_submitted": 47,
    "response_rate": 0.23,
    "interview_rate": 0.12,
    "last_discovery_run": {
      "completed_at": "ISO8601",
      "jobs_found": 34,
      "jobs_matched": 8
    },
    "recent_matches": [...],
    "recent_activity": [...]
  }
}
```

### Notifications

**GET /api/notifications**
- Auth: Required
- Query: `?read=false&page=1&limit=20`
- Response: Paginated notifications

**PATCH /api/notifications/:id/read**
- Auth: Required
- Action: Marks notification as read

**POST /api/notifications/read-all**
- Auth: Required
- Action: Marks all notifications as read

### Webhooks

**POST /api/webhooks/stripe**
- Auth: Stripe webhook signature verification
- Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Updates subscription status and limits in database

**POST /api/webhooks/email-inbound**
- Auth: SendGrid webhook signature verification
- Handles: Inbound email received
- Action: Parses email, identifies user by forwarding address, creates job posting, triggers pipeline

### Supabase Edge Functions

These are not called directly by the frontend. They are invoked by pg_cron triggers or by other server-side code.

**`/functions/v1/trigger-discoveries`**
- Input: None — queries the database.
- Action: Finds all users where `search_preferences.is_active = true` AND `search_preferences.next_discovery_at <= now()`. For each, invokes `discover-jobs` with that user's `profile_id`. After each invocation, updates `next_discovery_at` based on the user's subscription tier (free=+12h, pro=+6h, premium=+1h).
- Called by: pg_cron every hour.
- This is how per-user scheduling works without creating a separate cron job per user.

**`/functions/v1/discover-jobs`**
- Input: `{ "profile_id": "uuid" }`
- Action: Fetches jobs from all configured sources (SerpAPI, JSearch, Greenhouse boards from `tracked_boards`, Lever boards from `tracked_boards`, pending forwarded emails) in parallel. Deduplicates against existing postings. Saves new postings to `job_postings`. **Enqueues `pipeline_jobs` with `step='pre_screen'`** for each new posting. Does NOT run evaluation directly.
- Called by: `trigger-discoveries` (or directly for manual triggers)

**`/functions/v1/process-pipeline`** (the worker)
- Input: None — it reads from the `pipeline_jobs` queue table.
- Action: Calls `claim_pipeline_job()` to atomically claim one pending job. Based on the `step` field, calls the appropriate agent function. On success, enqueues the next step. On failure, calls `fail_pipeline_job()` for exponential backoff. Wraps every LLM call with Langfuse tracing.
- Called by: pg_cron every 30 seconds.
- Worker pseudocode:
```
const startTime = Date.now()
WHILE (Date.now() - startTime < 120_000):  // Loop until 120s of 150s timeout
  1. SELECT * FROM claim_pipeline_job()
  2. IF no job returned: exit (nothing to do)
  3. TRY:
     SWITCH job.step:
       'pre_screen':
         Run Haiku pre-screen
         IF pass → enqueue pipeline_job(step='evaluate')
         IF fail → mark completed (no evaluation record created, invisible to user)
       'evaluate':
         Run Sonnet evaluation (with prompt caching)
         Validate output with EvaluationSchema (Zod)
         Save to job_evaluations
         IF passes_threshold → create application, enqueue pipeline_job(step='tailor')
       'tailor':
         Run Sonnet tailoring
         Validate output with TailoredResumeSchema (Zod)
         Save resume_version → enqueue pipeline_job(step='generate_materials')
       'generate_materials':
         Call 1: Sonnet → cover letter + "why interested" answer
         Call 2: Haiku → extraction-based application answers
         Validate with MaterialsSchema (Zod)
         Update application with materials → enqueue pipeline_job(step='generate_files')
       'generate_files':
         Generate PDF + DOCX → Upload to Storage
         Set application status='ready' → create notification
     UPDATE pipeline_jobs SET status='completed', completed_at=now()
  4. CATCH error:
     CALL fail_pipeline_job(job.id, error.message)
```

**`/functions/v1/generate-resume-files`**
- Input: `{ "resume_version_id": "uuid" }`
- Action: Generates PDF and DOCX files from the resume JSON, uploads to Supabase Storage. Can also be called standalone for re-generation.

**`/functions/v1/parse-job-url`**
- Input: `{ "url": "string" }`
- Action: Fetches URL, parses job posting content using Haiku, returns structured data. Used by the manual job addition flow.

**pg_cron schedule configuration:**
```sql
-- Process pipeline worker: every 30 seconds
SELECT cron.schedule('process-pipeline', '30 seconds',
  $$SELECT net.http_post(
    'https://<project>.supabase.co/functions/v1/process-pipeline',
    '{}',
    '{"Authorization": "Bearer <service_role_key>"}'
  )$$
);

-- Trigger discoveries for users whose next_discovery_at has passed: every hour
SELECT cron.schedule('trigger-discoveries', '0 * * * *',
  $$SELECT net.http_post(
    'https://<project>.supabase.co/functions/v1/trigger-discoveries',
    '{}',
    '{"Authorization": "Bearer <service_role_key>"}'
  )$$
);
```

---

## §9 Screens

### Screen Inventory

| # | Screen | Route | Auth | Description |
|---|--------|-------|------|-------------|
| 1 | Landing Page | `/` | No | Marketing page, value prop, pricing, CTA to sign up |
| 2 | Sign Up | `/signup` | No | Email + password + full name registration form |
| 3 | Sign In | `/signin` | No | Email + password login form |
| 4 | Forgot Password | `/forgot-password` | No | Password reset email request |
| 5 | Onboarding — Basic Info | `/onboarding/basics` | Yes | Name, country, location, links |
| 6 | Onboarding — Headline | `/onboarding/headline` | Yes | Professional headline + summary with AI assist |
| 7 | Onboarding — Work Experience | `/onboarding/experience` | Yes | Add/edit work history + achievement bullets |
| 8 | Onboarding — Education | `/onboarding/education` | Yes | Add/edit education entries |
| 9 | Onboarding — Skills | `/onboarding/skills` | Yes | Add skills with AI suggestions |
| 10 | Onboarding — Projects & Certs | `/onboarding/projects` | Yes | Optional projects and certifications |
| 11 | Onboarding — Preferences | `/onboarding/preferences` | Yes | Job search preferences and match threshold |
| 12 | Onboarding — Resume Upload | `/onboarding/upload` | Yes | Optional resume upload with parsing |
| 13 | Dashboard | `/dashboard` | Yes | Overview: queue count, stats, recent matches, activity feed |
| 14 | Job Feed | `/jobs` | Yes | All discovered jobs with filters, search, sort |
| 15 | Job Detail | `/jobs/:id` | Yes | Full job posting + evaluation breakdown |
| 16 | Review Queue | `/queue` | Yes | Prepared applications awaiting approval |
| 17 | Application Detail | `/queue/:id` | Yes | Full application: job, evaluation, resume preview, cover letter, answers |
| 18 | Resume Preview | `/queue/:id/resume` | Yes | Full-page tailored resume preview with base comparison |
| 19 | Application Tracker | `/tracker` | Yes | Kanban board of all submitted applications |
| 20 | Application Tracker Detail | `/tracker/:id` | Yes | Single application: timeline, notes, materials, status management |
| 21 | Add Job | `/jobs/add` | Yes | Manual job URL input or paste description |
| 22 | Profile | `/settings/profile` | Yes | Edit all knowledge base fields |
| 23 | Search Preferences | `/settings/preferences` | Yes | Edit search preferences |
| 24 | Notifications | `/notifications` | Yes | All notifications with read/unread state |
| 25 | Subscription | `/settings/subscription` | Yes | Current plan, usage, upgrade/downgrade |
| 26 | Account Settings | `/settings/account` | Yes | Email, password, delete account |
| 27 | Pipeline Admin | `/admin/pipeline` | Admin | Pipeline health: jobs by status, error rates, avg duration, per-user cost, zombie count |

### Screen Details

#### 1. Landing Page (`/`)

**Layout:** Full-width marketing page. No sidebar. Sticky top nav with logo, "Sign In" link, and "Get Started" CTA button.

**Sections:**
- **Hero:** Headline: "Your AI Recruiting Agent." Subheading: "Woodhouse finds jobs, tailors your resume, and prepares applications — while you focus on what matters." CTA: "Get Started Free." Hero illustration or product screenshot.
- **How It Works:** Three-step visual: 1) Set up your profile, 2) Woodhouse scans and matches, 3) Review and apply. Each step has an icon, title, and one sentence.
- **Features Grid:** 6 feature cards: Automated Discovery, Smart Matching, Resume Tailoring, Material Generation, Review Queue, Application Tracking. Each card: icon, title, 2-sentence description.
- **Pricing:** Three-tier pricing table (Free, Pro, Premium). See §11 for tier details.
- **Footer:** Links, legal, contact.

#### 2-4. Auth Screens (`/signup`, `/signin`, `/forgot-password`)

**Layout:** Centered card on a clean background. Logo above the card.

**Sign Up form:** Full name, email, password, confirm password. "Create Account" button. Link to Sign In.
**Sign In form:** Email, password. "Sign In" button. Link to Forgot Password. Link to Sign Up.
**Forgot Password form:** Email field. "Send Reset Link" button. Link back to Sign In.

#### 5-12. Onboarding Screens (`/onboarding/*`)

**Layout:** Centered content area with a progress bar at the top showing 8 steps. "Back" and "Continue" buttons at the bottom. Step title and description at the top.

**Key interactions:**
- Step 7 (Work Experience): Each entry is a card that expands to show achievement bullets. "Add Experience" button at bottom. Each achievement has an "Improve with AI" sparkle icon button.
- Step 9 (Skills): Tag-style input. Category and proficiency dropdowns per skill. "Suggest Skills" AI button analyzes work history.
- Step 11 (Preferences): Match threshold is a slider (0-100) with labels: 50 = "Cast a wide net", 70 = "Balanced" (default), 90 = "Only strong matches."
- Step 12 (Resume Upload): Drag-and-drop zone or file picker. After upload, a parsing progress indicator, then a review screen showing extracted data with checkboxes to confirm or discard each section.

#### 13. Dashboard (`/dashboard`)

**Layout:** Sidebar navigation (persistent across all authenticated pages) + main content area.

**Sidebar items:** Dashboard, Job Feed, Review Queue, Tracker, Add Job, Settings (expandable: Profile, Preferences, Subscription, Account).

**Main content:**
- **Top row — Key Metrics:** Four stat cards in a row:
  - "Applications Ready" (number in queue)
  - "Used This Month" (X of Y, with progress bar)
  - "Submitted" (total count)
  - "Response Rate" (percentage)
- **Middle row — Recent Matches:** A scrollable list of the 5 most recent jobs that passed the threshold. Each shows: company, title, match score badge, time since discovered. Click opens Job Detail.
- **Bottom row — Activity Feed:** Chronological list of recent events: new jobs matched, applications prepared, status updates. Each entry has an icon, description, and timestamp.
- **Discovery Status Card:** Small card showing last scan time, next scan time, jobs found/matched in last run.

#### 14. Job Feed (`/jobs`)

**Layout:** Sidebar + main content.

**Main content:**
- **Filter bar at top:** Search input, source dropdown, score range slider, country filter, location filter, remote toggle, status filter (active/expired). "Clear Filters" button.
- **Sort:** Dropdown: Match Score (high to low), Newest, Company Name.
- **Job list:** Vertical list of job cards. Each card shows:
  - Company name + logo (if available)
  - Job title
  - Location + remote badge
  - Source badge (Google Jobs, Greenhouse, Manual, etc.)
  - Match score badge (color-coded: green 80+, yellow 60-79, red below 60)
  - Posted date / discovered date
  - Quick actions: "View Details", "Add to Queue" (for below-threshold jobs)
- **Pagination** at bottom.
- **Empty state:** "No jobs found matching your criteria. Try adjusting your filters or search preferences."

#### 15. Job Detail (`/jobs/:id`)

**Layout:** Sidebar + main content (full width).

**Two-column layout:**
- **Left column (60%):** Full job description. Sections: About the Role, Responsibilities, Requirements, Preferred Qualifications, Benefits, Application Link.
- **Right column (40%):** Evaluation card:
  - Overall score (large, color-coded)
  - Recommendation badge (Strong Match, Good Match, etc.)
  - Dimension score bars (5 horizontal bars with labels and scores)
  - Strengths list (green checkmarks)
  - Gaps list (orange warning icons)
  - Reasoning paragraph
  - Action button: "Prepare Application" (triggers tailoring) or "View Application" (if already prepared) or "Below Threshold — Prepare Anyway"

#### 16. Review Queue (`/queue`)

**Layout:** Sidebar + main content.

**Tabs:** Ready (default), Saved for Later, Skipped.

**Application cards (more prominent than job cards):**
- Company name + logo
- Job title
- Match score badge
- "Prepared X hours/days ago"
- Preview of tailoring notes (one line)
- Action buttons: "Review", "Quick Approve", "Skip"

**Empty state:** "No applications waiting for review. Woodhouse will prepare new applications as matching jobs are discovered."

#### 17. Application Detail (`/queue/:id`)

**Layout:** Sidebar + full-width main content. Tabbed interface within the content area.

**Tabs:**
- **Overview:** Job details summary + evaluation summary side by side. Action buttons (Approve, Edit & Approve, Skip, Save for Later).
- **Resume:** Tailored resume preview rendered as a document. Toggle to show "Changes from base" (highlighted diff). "Edit" button opens inline editor.
- **Cover Letter:** Full cover letter text. Inline editable. "Regenerate" button to get a new version.
- **Application Answers:** List of question-answer pairs. Each answer is inline editable. Source note shown below each (where the data came from).
- **Job Posting:** Full original job description for reference.

**Approve flow:** User clicks "Approve" → confirmation modal showing what will happen ("Resume files will be generated. The application link will open in a new tab.") → on confirm: generates files, opens URL, shows a toast with "Copied to clipboard" for the first answer field, status changes to "approved."

#### 18. Resume Preview (`/queue/:id/resume`)

**Layout:** Full-page document preview. Top bar with: "Back to Application", "Download PDF", "Download DOCX", "Toggle Diff View."

**Default view:** Resume rendered as it would appear on paper — formatted, styled, professional.
**Diff view:** Two-column: base resume on the left, tailored on the right. Changes highlighted in the tailored version (additions in green, reorderings in blue).

#### 19. Application Tracker (`/tracker`)

**Layout:** Sidebar + main content (full width for kanban board).

**Kanban columns:** Submitted | Acknowledged | Screening | Interviewing | Offer | Accepted | Rejected | Withdrawn.

**Each card:** Company name, job title, days since last update, small match score badge. Cards are draggable between columns (updates status on drop).

**Top bar:** Filter by date range, search by company/title. Stats summary: total in pipeline, response rate, average days to response.

**Empty state:** "No applications tracked yet. Approve applications from your Review Queue to start tracking."

#### 20. Application Tracker Detail (`/tracker/:id`)

**Layout:** Sidebar + main content.

**Sections:**
- **Header:** Company, title, status badge, match score. Quick action buttons: Update Status (dropdown), Add Note, Set Reminder.
- **Timeline:** Vertical timeline of all events (status changes, notes, reminders). Most recent at top.
- **Materials:** Collapsible sections for: tailored resume (with download links), cover letter, application answers.
- **Evaluation:** Collapsible section showing the original evaluation.
- **Notes:** Free-form text area for adding notes. "Add Note" button.
- **Reminders:** Set a follow-up reminder date. System will create a notification on that date.

#### 21. Add Job (`/jobs/add`)

**Layout:** Sidebar + centered form.

**Two options (tabs or toggle):**
- **Paste URL:** Single URL input field. "Fetch & Parse" button. Shows parsing progress, then displays extracted data for review before saving.
- **Manual Entry:** Full form: job title, company name, country, location, remote toggle, job type, experience level, description (large textarea), application URL. "Save & Evaluate" button.

#### 22-26. Settings Screens (`/settings/*`)

**Layout:** Sidebar + main content. Settings sub-navigation (Profile, Preferences, Subscription, Account) as a horizontal tab bar or vertical sub-menu within settings.

**Profile (`/settings/profile`):** Same fields as onboarding but in an edit-in-place format. Sections: Basic Info, Professional Summary, Work Experience, Education, Skills, Projects, Certifications. Each section is a collapsible panel with an "Edit" button. AI assist buttons available.

**Preferences (`/settings/preferences`):** Job search preferences form (same as onboarding step 11). Plus: email forwarding address display with copy button, current scan frequency display (derived from plan — "Every 12 hours" for free, "Every 6 hours" for Pro, "Every hour" for Premium, with upgrade prompt), tracked company boards management (add/remove Greenhouse and Lever board URLs), email digest preference.

**Subscription (`/settings/subscription`):** Current plan card with usage bar (X of Y applications used this period). Period reset date. Upgrade/downgrade buttons. If on paid plan: "Manage Billing" button opens Stripe Customer Portal.

**Account (`/settings/account`):** Change email, change password, email digest toggle, notification preferences (in-app, email for each notification type), "Delete Account" danger zone at bottom.

#### 27. Pipeline Admin (`/admin/pipeline`)

**Layout:** Full-width. No sidebar (internal tool, not user-facing). Simple nav bar with logo + "Back to Dashboard."

**Access:** Admin-only. Protected by a check against an `is_admin` flag on the profile or an admin email allowlist in environment variables.

**Sections:**
- **Pipeline Health:** Four stat cards: Pending Jobs, Processing Jobs, Failed Jobs (last 24h), Zombie Jobs (processing > 5 min).
- **Jobs by Step:** Bar chart or table showing counts per step (pre_screen, evaluate, tailor, generate_materials, generate_files) × status (pending, processing, completed, failed).
- **Error Log:** Scrollable list of recent failed pipeline jobs: timestamp, step, user email, job posting title, error message, attempt count. Click to see full `input_data` and `output_data`.
- **Per-User Cost (from Langfuse):** Table showing top users by token usage this billing period: user email, total input tokens, total output tokens, estimated API cost, plan tier. Highlights any user where estimated cost > plan revenue.
- **Validation Failure Rate:** Zod validation failure count and percentage over last 7 days, broken down by agent type. Target: <1%.

---

## §10 Design System

### Brand Identity

Woodhouse is named after the quintessential butler — efficient, reliable, working tirelessly on your behalf. The design reflects this: professional, composed, competent. Not flashy. Not playful. It communicates: "Your job search is handled."

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#1e3a5f` | Deep navy. Primary buttons, active nav items, headings. |
| `--primary-light` | `#2d5a8e` | Primary hover state, secondary emphasis. |
| `--primary-dark` | `#132843` | Primary pressed state. |
| `--accent` | `#d97706` | Warm amber. Accent buttons, badges, highlights, CTAs. |
| `--accent-light` | `#f59e0b` | Accent hover, notification indicators. |
| `--background` | `#fafaf9` | Page background. Warm off-white. |
| `--surface` | `#ffffff` | Cards, panels, modals. |
| `--surface-alt` | `#f5f5f4` | Alternate surface for contrast (e.g., sidebar, table rows). |
| `--border` | `#e7e5e4` | Card borders, dividers, input borders. |
| `--border-focus` | `#1e3a5f` | Input focus ring. |
| `--text-primary` | `#18181b` | Primary text. Near-black. |
| `--text-secondary` | `#52525b` | Secondary text. Descriptions, labels. |
| `--text-muted` | `#a1a1aa` | Muted text. Timestamps, placeholders. |
| `--success` | `#059669` | Success states, "strong match" badges, positive metrics. |
| `--success-bg` | `#ecfdf5` | Success background (light). |
| `--warning` | `#d97706` | Warning states, "possible match" badges. |
| `--warning-bg` | `#fffbeb` | Warning background (light). |
| `--error` | `#dc2626` | Error states, "no match" badges, destructive actions. |
| `--error-bg` | `#fef2f2` | Error background (light). |
| `--info` | `#2563eb` | Informational states, links. |
| `--info-bg` | `#eff6ff` | Info background (light). |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family` | `'Inter', system-ui, sans-serif` | All text. Inter from Google Fonts. |
| `--font-size-xs` | `12px / 16px` | Badges, timestamps, fine print |
| `--font-size-sm` | `14px / 20px` | Secondary text, table cells, form labels |
| `--font-size-base` | `16px / 24px` | Body text, form inputs |
| `--font-size-lg` | `18px / 28px` | Card titles, section labels |
| `--font-size-xl` | `20px / 28px` | Page section headings |
| `--font-size-2xl` | `24px / 32px` | Page titles |
| `--font-size-3xl` | `30px / 36px` | Hero headings, dashboard stat numbers |
| `--font-size-4xl` | `36px / 40px` | Landing page hero headline |
| `--font-weight-normal` | `400` | Body text |
| `--font-weight-medium` | `500` | Labels, table headers, nav items |
| `--font-weight-semibold` | `600` | Card titles, section headings |
| `--font-weight-bold` | `700` | Page titles, stat numbers, emphasis |

### Spacing

Base unit: `4px`. All spacing uses multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Tight internal padding (badge padding, icon gaps) |
| `--space-2` | `8px` | Input padding, compact card padding |
| `--space-3` | `12px` | Between closely related elements |
| `--space-4` | `16px` | Standard card padding, form field gap |
| `--space-5` | `20px` | Between card sections |
| `--space-6` | `24px` | Between cards in a list, section padding |
| `--space-8` | `32px` | Page section gap |
| `--space-10` | `40px` | Major section separation |
| `--space-12` | `48px` | Page top/bottom padding |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Badges, small elements |
| `--radius-md` | `8px` | Buttons, inputs, cards |
| `--radius-lg` | `12px` | Modals, large cards |
| `--radius-full` | `9999px` | Avatar circles, pills |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle depth on cards |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` | Elevated cards, dropdowns |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | Modals, popovers |

### Key Components

**Match Score Badge:**
- Circular or rounded-rectangle badge showing the score number.
- Color coding: `--success` for 80+, `--warning` for 60-79, `--error` for below 60.
- Used on: job cards, application cards, evaluation panels.

**Stat Card:**
- White surface, `--shadow-sm`, `--radius-md`.
- Top: label text (muted, sm). Bottom: large number (bold, 3xl). Optional: subtitle or trend indicator.

**Job Card:**
- White surface, `--shadow-sm`, `--radius-md`, `--space-4` padding.
- Left: Company logo placeholder (40x40, rounded). Right: Match score badge.
- Content: job title (semibold, lg), company (normal, base), location + badges (muted, sm).
- Bottom: source badge, posted date, quick action buttons.

**Application Card:**
- Same base as job card but with a left accent border (color = match score color).
- Additional: "Prepared X ago" timestamp, tailoring preview line.

**Sidebar Navigation:**
- Width: 240px. Background: `--surface-alt`. Border-right: `--border`.
- Logo at top. Nav items: icon + label. Active item: `--primary` background with white text. Hover: `--surface` background.
- Collapsed mode on smaller screens (icon only, 64px wide).

**Empty State:**
- Centered in the content area. Illustration or icon (muted). Heading (semibold, xl). Description (normal, base, secondary text). Optional CTA button.

**Loading State:**
- Skeleton loaders matching the shape of the content they replace. Animated shimmer. Used for cards, lists, stat values.

**Toast Notifications:**
- Bottom-right corner. Auto-dismiss after 5 seconds. Types: success (green left border), error (red), info (blue), warning (amber).

### Interaction Principles

- **Optimistic updates:** Status changes (approve, skip, mark as read) update the UI immediately. Revert on server error.
- **Keyboard navigation:** All interactive elements accessible via Tab. Enter/Space to activate. Escape to close modals/dropdowns.
- **Loading indicators:** Skeleton loaders for initial page loads. Spinner overlays for actions (approve, generate). Progress bars for multi-step operations (pipeline).
- **Confirmation for destructive actions:** Skip, withdraw, delete account require a confirmation dialog. Approve does not (it's the primary happy path).
- **Responsive breakpoints:** Desktop (1280px+), tablet (768px-1279px), mobile (below 768px). Sidebar collapses on tablet, becomes a bottom nav on mobile.

---

## §11 Revenue Model

### Pricing Tiers

| Feature | Free | Pro ($19/mo) | Premium ($39/mo) |
|---------|------|-------------|-----------------|
| Applications per month | 5 | 50 | 200 |
| Job discovery | Every 12 hours | Every 6 hours | Every 1 hour |
| Sources | Aggregator APIs only | All sources | All sources |
| Manual job input | Yes | Yes | Yes |
| Resume tailoring | Yes | Yes | Yes |
| Cover letter generation | No | Yes | Yes |
| Application answers | Basic (3 fields) | Full | Full |
| Resume output formats | PDF only | PDF + DOCX | PDF + DOCX |
| Application tracker | Basic (status only) | Full (timeline, notes, reminders) | Full |
| Email forwarding | No | Yes | Yes |
| Email digest | Weekly only | Daily or weekly | Daily or weekly |
| Analytics | None | Basic (response rate) | Full (trends, optimization insights) |
| Priority support | No | No | Yes |
| Auto-submit (Phase 2) | No | No | Yes |

### Tier Economics

Per-application AI cost is ~$0.08 before optimizations, ~$0.03-0.04 with prompt caching and Haiku pre-screen.

| Tier | Revenue | Max Apps | Est. API Cost/mo | Gross Margin |
|------|---------|----------|-----------------|--------------|
| Free | $0 | 5 | ~$0.20 | Loss leader |
| Pro ($19) | $19 | 50 | ~$2-4 | 79-89% |
| Premium ($39) | $39 | 200 | ~$8-16 | 59-79% |

The Premium cap of 200 applications/month (vs. the original "unlimited" design) ensures healthy margins even for power users. 200 applications/month is ~10 per business day — more than sufficient for even the most active job seekers (Priya persona). The 1-hour discovery cadence and priority support remain the primary Premium differentiators alongside the higher volume cap.

If market feedback demands a higher cap, the cost optimizations (prompt caching, Haiku pre-screen, Batch API) must be fully implemented first. Monitor per-user API cost via the Langfuse-powered admin dashboard.

### Billing

- Monthly billing via Stripe.
- Annual option: 2 months free (Pro: $190/year, Premium: $390/year).
- Usage counter resets on billing cycle date.
- When a free user hits 5 applications: they see remaining applications prepared but locked behind an upgrade prompt. Materials are visible but blurred. This creates urgency — the work is done, they just need to unlock it.
- No credit card required for free tier.
- 7-day free trial of Pro for new users (optional, configurable).

### Expansion Motion

Free → Pro: User hits the 5-application limit. Sees prepared applications they can't approve. Upgrade prompt.
Pro → Premium: User wants faster scanning (1h vs 6h), higher volume (200 vs 50 apps), cover letters, full analytics, or (later) auto-submit. The analytics in Premium show them exactly how Woodhouse is improving their job search — making the value tangible.

---

## §12 GTM Strategy

### Positioning

**Category:** AI job search agent.
**Message lead:** "Stop searching for jobs. Let Woodhouse find them for you."
**Words to use:** Agent, automated, tailored, personal recruiter, pipeline, matches.
**Words to avoid:** Bot, scraper, spam, mass-apply, AI-generated (in the negative sense). Woodhouse is a precision tool, not a spam cannon.

### Target Customer

The first person to pay is Sarah Chen: an employed professional exploring new opportunities who values her time more than the subscription cost. She's currently frustrated by the manual grind of job searching and would happily pay $19/month for someone (or something) to do the legwork.

### Launch Channels

1. **Hacker News / Product Hunt / Indie Hackers:** Tech-forward audience that understands and values AI-powered tools. Launch with a "Show HN" post demonstrating the product on a real job search.
2. **Reddit (r/jobs, r/cscareerquestions, r/experienceddevs):** Active communities of job seekers. Provide genuine value in comments, share the product when relevant.
3. **SEO / Content:** Blog posts on job search strategy, resume optimization, ATS tips. Target long-tail keywords like "how to tailor resume for specific job" and "automated job search tools."

### Initial Motion

Self-serve. No sales team. Free tier drives adoption. Product-led growth: the prepared-but-locked applications create natural upgrade pressure. Word-of-mouth from users who land interviews through Woodhouse applications.

---

## §13 Post-MVP: Auto-Submit Strategy

This section details the Phase 2 auto-submit capability. It is NOT part of MVP but is architecturally significant enough to document now so MVP decisions don't block it.

### Overview

Auto-submit automates the final step: instead of the user opening the application link and manually filling out forms, Woodhouse fills and submits the application programmatically.

### ATS Detection and Classification

Before auto-submit can work, the system must identify which ATS the company uses. This determines the submission strategy.

**ATS identification approach:**
1. **URL pattern matching:** Greenhouse (`boards.greenhouse.io/*`), Lever (`jobs.lever.co/*`), Workday (`*.myworkdayjobs.com/*`), Ashby (`jobs.ashbyhq.com/*`).
2. **HTML signature detection:** Each ATS has characteristic HTML patterns (specific class names, meta tags, form structures) that can be detected by parsing the application page.
3. **Classification storage:** Each job posting gets an `ats_type` field identifying the platform. Once identified for a company, this is cached.

### Submission Strategies by ATS

#### Greenhouse
- **Method:** Greenhouse has a public job board API that includes application submission.
- **Endpoint:** `POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}`
- **Fields:** First name, last name, email, phone, resume (file upload), cover letter, custom questions.
- **Approach:** Direct API call. Most reliable auto-submit path.

#### Lever
- **Method:** Lever's application form is a standard HTML form with predictable field names.
- **Approach:** Browser automation (Playwright) to fill and submit the form. Fields are mapped from the user's profile.

#### Workday
- **Method:** Workday applications are complex multi-step forms with dynamic rendering.
- **Approach:** This is the hardest ATS to automate. Phase 2 will support "assisted fill" — Woodhouse opens the page and fills fields where possible, but the user completes the final submission. Full automation is a Phase 3 goal.

#### Ashby
- **Method:** Ashby has a relatively clean application form.
- **Approach:** Browser automation (Playwright) similar to Lever.

#### Email Applications
- **Method:** Some postings accept applications via email.
- **Approach:** Compose and send an email with the tailored resume attached and the cover letter as the email body. Sent from the user's configured email (via OAuth) or from Woodhouse on behalf of the user.

#### Direct URL (Unsupported ATS)
- **Fallback:** For ATS platforms not yet supported, continue with the MVP approach: open the link, provide copy-to-clipboard.

### Browser Automation Architecture

For ATS platforms requiring browser automation (Lever, Ashby, others):

**Technology:** Playwright running in a containerized environment (not in Supabase Edge Functions — these need a full browser).

**Infrastructure:** A separate microservice (e.g., a Docker container on Fly.io or Railway) running a Playwright-based submission worker.

**Flow:**
1. Application is approved by the user and flagged for auto-submit.
2. The Next.js backend sends a submission request to the automation service.
3. The automation service:
   a. Opens the application URL in a headless browser.
   b. Identifies the ATS type and selects the appropriate form-filling script.
   c. Maps user profile data to form fields.
   d. Fills all fields.
   e. Uploads the resume file.
   f. Takes a screenshot of the filled form for verification.
   g. Submits the form.
   h. Captures the confirmation page/message.
4. Results (success/failure, screenshot, confirmation) are sent back and logged.

**Verification step:** Before final submission, the system captures a screenshot of the filled form and can optionally require user confirmation ("Your application to [Company] is ready to submit. [Screenshot]. Confirm?"). This is configurable — power users can enable fully automatic submission.

### Form Field Mapping

A mapping layer translates between the user's profile data and ATS-specific form fields:

| Profile Data | Greenhouse | Lever | Common Label |
|-------------|-----------|-------|-------------|
| `full_name` (split) | `first_name`, `last_name` | `name` | First Name, Last Name |
| `email` | `email` | `email` | Email |
| `phone` | `phone` | `phone` | Phone |
| resume file | `resume` (file) | `resume` (file) | Resume/CV |
| `cover_letter` | `cover_letter` | `comments` | Cover Letter |
| `linkedin_url` | custom field | `urls[LinkedIn]` | LinkedIn URL |
| `portfolio_url` | custom field | `urls[Portfolio]` | Website/Portfolio |
| `work_authorization` | custom field | custom field | Work Authorization |
| `salary_expectations` | custom field | custom field | Salary Expectations |

Custom questions (specific to each posting) are handled by the Materials Agent during the preparation phase. The auto-submit system maps these pre-generated answers to the corresponding form fields.

### Error Handling

- **Form structure changed:** If the automation script can't find expected fields, it aborts and falls back to the manual approach. The user is notified.
- **CAPTCHA detected:** Abort auto-submit. Notify user. Fall back to manual.
- **Rate limiting:** Space submissions to no more than 5 per hour per IP. Use rotating proxies if needed.
- **Submission confirmation unclear:** If the system can't confirm the application was received, it flags the submission as "unconfirmed" and asks the user to verify.

### Phased Rollout

| Phase | Scope | Timeline |
|-------|-------|----------|
| 2a | Greenhouse API submissions (highest reliability) | First post-MVP release |
| 2b | Lever + Ashby browser automation | 4-6 weeks after 2a |
| 2c | Email-based applications | Concurrent with 2b |
| 2d | Workday assisted fill | 8-12 weeks after 2a |
| 2e | Additional ATS platforms based on user demand | Ongoing |

### Premium-Only Feature

Auto-submit is a Premium tier feature ($39/month). This is the primary driver for Pro → Premium upgrades. Free and Pro users continue with the open-link-and-copy approach.

---

*End of Masterplan*
