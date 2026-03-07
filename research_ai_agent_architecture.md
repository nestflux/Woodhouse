# Woodhouse — AI Agent Architecture Research Report

> **Date:** 2026-03-06
> **Purpose:** Evaluate agent architecture options for the Woodhouse job application pipeline
> **Scope:** Patterns, frameworks, and production strategies for a multi-step AI pipeline running on Next.js + Supabase + Vercel + Anthropic API

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Fundamental Decision: Agents vs Workflows](#2-the-fundamental-decision-agents-vs-workflows)
3. [Architecture Patterns Deep Dive](#3-architecture-patterns-deep-dive)
4. [Framework Evaluation](#4-framework-evaluation)
5. [The "No Framework" Approach: 12-Factor Agents](#5-the-no-framework-approach-12-factor-agents)
6. [Durable Execution Platforms](#6-durable-execution-platforms)
7. [Architecture Options for Woodhouse](#7-architecture-options-for-woodhouse)
8. [Recommended Architecture](#8-recommended-architecture)
9. [Cost Analysis](#9-cost-analysis)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Sources](#11-sources)

---

## 1. Executive Summary

After researching the current landscape of AI agent architectures (2025-2026), frameworks, durable execution platforms, and production patterns, three key findings emerged:

### Finding 1: Woodhouse needs workflows, not agents

Anthropic themselves distinguish between **workflows** ("systems where LLMs and tools are orchestrated through predefined code paths") and **agents** ("systems where LLMs dynamically direct their own processes and tool usage"). Woodhouse's pipeline is deterministic — the steps are always Find → Evaluate → Tailor → Generate → Queue. The LLM provides intelligence within each step, but the control flow is predefined. This is a workflow, not an agent.

### Finding 2: Heavy agent frameworks are overkill

LangGraph, CrewAI, AutoGen, and similar frameworks are designed for open-ended, multi-turn agent interactions where the LLM decides what to do next. Woodhouse doesn't need this. The most successful production AI systems use simple, composable functions with LLM calls at specific points — what the 12-Factor Agents methodology calls "well-engineered software that sprinkles an LLM only where probabilistic reasoning truly helps."

### Finding 3: A durable execution platform solves the hard problems

The real challenges for Woodhouse are: scheduled execution, retry on failure, state management across steps, timeout handling, and multi-tenant job processing. These are solved by durable workflow platforms (Trigger.dev, Inngest, or a Supabase queue pattern) — not by agent frameworks.

**Recommended architecture: Supabase Queue Pattern + structured LLM calls (no agent framework).**

For teams wanting more sophisticated orchestration: **Trigger.dev** (native Supabase + Next.js integration) as an upgrade path.

---

## 2. The Fundamental Decision: Agents vs Workflows

### What Anthropic Says

Anthropic's own research paper "Building Effective Agents" makes the distinction clear:

| Dimension | Workflows | Agents |
|-----------|-----------|--------|
| Control flow | Predefined in code | LLM decides dynamically |
| Predictability | High — same inputs produce same flow | Low — LLM may take different paths |
| Reliability | Easy to test and debug | Harder to predict and validate |
| Cost | Lower — fewer LLM calls needed | Higher — each decision requires inference |
| Best for | Well-defined, repeatable tasks | Open-ended problems with unknown steps |

### Where Woodhouse Falls

Every step in the Woodhouse pipeline is predetermined:

```
Discovery → Evaluation → Threshold Check → Tailoring → Materials → Queue
```

The LLM provides intelligence **within** each step (e.g., "score this job against this profile"), but the **sequence of steps** never changes. The LLM doesn't decide "should I evaluate or tailor next?" — the code does.

This is exactly what Anthropic calls a **Prompt Chaining** workflow — "decomposing tasks into sequential steps where each LLM call processes prior outputs."

### The Data Supports Workflows

According to IntuitionLabs' 2025 research:

- **78% of enterprises** use workflow-based MLOps pipelines in production
- **<5% of enterprise applications** feature true autonomous agents
- Agents can be **10x more expensive** than traditional API workflows
- **40% of agentic projects will be cancelled by 2027** (Gartner) due to costs and unclear ROI

### Verdict

**Woodhouse should use a workflow architecture, not an agent architecture.** The LLM is a tool called within a deterministic pipeline, not a decision-maker controlling the pipeline.

---

## 3. Architecture Patterns Deep Dive

Anthropic identifies five workflow patterns. Here's how each maps to Woodhouse:

### Pattern 1: Prompt Chaining (Primary Pattern for Woodhouse)

**How it works:** Sequential steps where each LLM call processes the output of the prior step. Programmatic "gates" validate intermediate results before proceeding.

**Woodhouse mapping:**
```
[Discovery: fetch jobs]
    → [Gate: deduplicate, validate]
    → [Evaluation: LLM scores job fit]
    → [Gate: threshold check]
    → [Tailoring: LLM generates resume]
    → [Gate: truthfulness validation]
    → [Materials: LLM generates cover letter + answers]
    → [Gate: completeness check]
    → [Queue: save to review queue]
```

Each arrow is a programmatic handoff. Each LLM call has a specific, bounded task.

**Why this fits:** Woodhouse tasks decompose naturally into a fixed sequence. Each step adds to the output. Gates between steps catch errors early.

### Pattern 2: Routing (Secondary Pattern)

**How it works:** Classify input and direct it to specialized handlers.

**Woodhouse mapping:**
- Route job postings to different parsers based on source (Greenhouse parser, Lever parser, email parser, generic parser)
- Route to different Claude models based on task complexity (Haiku for parsing, Sonnet for evaluation/tailoring)

### Pattern 3: Parallelization (Secondary Pattern)

**How it works:** Run independent tasks simultaneously and aggregate results.

**Woodhouse mapping:**
- Evaluate multiple jobs concurrently (each evaluation is independent)
- Query multiple job sources simultaneously during discovery
- Generate resume + cover letter in parallel (if cover letter doesn't depend on the final resume)

### Pattern 4: Orchestrator-Workers (Not Recommended)

**How it works:** Central LLM dynamically decomposes tasks and delegates to worker LLMs.

**Why not for Woodhouse:** The decomposition is fixed and known in advance. Having an LLM decide "which jobs to evaluate" when we already know the answer (all of them) adds cost and latency with zero benefit.

### Pattern 5: Evaluator-Optimizer (Optional Enhancement)

**How it works:** One LLM generates output; another evaluates and provides feedback iteratively.

**Potential Woodhouse use:** A quality-check step after resume tailoring — a "reviewer" prompt verifies the tailored resume only contains verified information from the knowledge base. This adds cost but strengthens the truthfulness constraint.

### Recommended Pattern Mix

| Pipeline Step | Primary Pattern | Secondary Pattern |
|--------------|----------------|-------------------|
| Discovery | Parallelization (multiple sources) | Routing (source-specific parsers) |
| Parsing/Normalization | Routing (by source type) | — |
| Evaluation | Prompt Chaining | Parallelization (multiple jobs) |
| Threshold Check | Programmatic gate (no LLM) | — |
| Resume Tailoring | Prompt Chaining | Evaluator-Optimizer (optional quality check) |
| Materials Generation | Prompt Chaining | Parallelization (cover letter + answers) |
| File Generation | Programmatic (no LLM) | — |
| Queue Notification | Programmatic (no LLM) | — |

---

## 4. Framework Evaluation

### The Current Landscape (2026)

| Framework | Architecture | Language | Best For | Woodhouse Fit |
|-----------|-------------|----------|----------|---------------|
| LangGraph | Graph-based state machines | Python | Complex stateful workflows with cycles | Overkill — Python-only, heavyweight |
| CrewAI | Role-based agent crews | Python | Multi-agent collaboration | Wrong paradigm — Woodhouse isn't multi-agent conversation |
| AG2 (AutoGen) | Conversational agent swarms | Python | Research/experimental | Not production-ready |
| OpenAI Agents SDK | Primitive-based (handoffs, guardrails) | Python | OpenAI ecosystem | Vendor lock-in, wrong provider |
| Mastra | TypeScript agent framework | TypeScript | Next.js agent apps | Closest match but still agent-oriented |
| Pydantic AI | Type-safe agents | Python | Reliability-critical domains | Python-only |
| Google ADK | Modular workflows | Multi-language | Google Cloud apps | Wrong cloud ecosystem |
| Claude Agent SDK | Tool-use agents | Python | Claude-powered agents | Python-only, more agent than workflow |

### Framework-by-Framework Analysis

#### LangGraph
- **Maturity:** High. v1.0 in late 2025. 38M monthly PyPI downloads.
- **Architecture:** Directed graphs where nodes are processing steps, edges are transitions, shared state flows through the graph.
- **Pros:** Production-proven, durable execution, LangSmith observability ($39/user/mo), human-in-the-loop support.
- **Cons:** Python-only (Woodhouse is TypeScript/Next.js). Verbose. Requires architectural decisions upfront. Heavy abstraction layer. The graph metaphor adds complexity for linear pipelines.
- **Verdict:** **Not suitable.** Wrong language, overcomplicated for a linear pipeline.

#### CrewAI
- **Maturity:** High. 44,600+ GitHub stars, 450M monthly workflows.
- **Architecture:** Role-based "crews" of agents that communicate and delegate to each other.
- **Pros:** Intuitive role modeling, fast to prototype, visual studio editor for non-technical design.
- **Cons:** Python-only. The "crew of agents communicating" model doesn't match Woodhouse's deterministic pipeline. "High-level abstractions can make it harder to figure out what happened" when debugging.
- **Verdict:** **Not suitable.** Wrong paradigm and wrong language.

#### AG2 (AutoGen)
- **Maturity:** Low for production. Research-focused.
- **Architecture:** Conversational agent swarms via group chats.
- **Cons:** "Not production-ready for most enterprise use cases." No built-in safety mechanisms. Community-maintained only.
- **Verdict:** **Not suitable.** Not production-ready.

#### Mastra
- **Maturity:** Medium-High. YC-backed, built by the Gatsby team.
- **Architecture:** TypeScript-first. Agents defined as classes with instructions, tools, and memory. Supports workflows as composable steps. Integrates with Next.js and Vercel AI SDK.
- **Pros:** TypeScript-native. Next.js integration. Structured output with Zod. Human-in-the-loop workflows. Model-agnostic (600+ models including Claude). Apache 2.0 open-source. Request context for multi-tenant model routing.
- **Cons:** Still relatively young ecosystem. Agent-oriented abstractions may not fit a pipeline model. Adds a dependency layer between your code and the Anthropic API. Not as battle-tested as simpler approaches.
- **Verdict:** **Possible but not recommended for Woodhouse.** It's the closest framework match (TypeScript, Next.js, supports Claude), but Woodhouse's pipeline is simple enough that the framework adds more complexity than it removes. Worth revisiting if agent complexity increases post-MVP.

#### Claude Agent SDK
- **Maturity:** High (backed by Anthropic).
- **Architecture:** Python SDK. Agents with custom tools implemented as in-process MCP servers. Tool Search for managing large tool sets. Agent Skills for packaging expertise.
- **Pros:** First-party Anthropic SDK. Deep Claude integration. MCP for standardized tool integrations.
- **Cons:** Python-only (renamed from Claude Code SDK, designed for coding agents). More suited for autonomous agents than deterministic pipelines.
- **Verdict:** **Not suitable.** Python-only, agent-oriented.

### The Deno Compatibility Dealbreaker

A critical finding from the research: **Supabase Edge Functions use the Deno runtime, not Node.js.** This eliminates most frameworks:

| Framework | Deno Compatible? | Status |
|-----------|-----------------|--------|
| LangGraph (TS) | Partial | Some dependencies fail in Deno module resolution |
| CrewAI | No | Python-only |
| AG2 (AutoGen) | No | Python-only |
| Claude Agent SDK | No | Python-only |
| OpenAI Agents SDK | Unconfirmed | Node.js-first, needs verification |
| Mastra | No | Node.js-first, uses native modules |
| Pydantic AI | No | Python-only |
| Anthropic TS SDK | **Yes** | Official Deno-compatible imports |

The **Anthropic TypeScript SDK is the only option with guaranteed Deno compatibility** — it ships with Deno-compatible imports. This alone settles the framework question for any code running in Supabase Edge Functions.

### Framework Summary

**None of the major agent frameworks are the right fit for Woodhouse.** The reasons:

1. **Runtime mismatch:** Supabase Edge Functions use Deno. Most frameworks require Node.js or Python. Only the Anthropic TS SDK is guaranteed Deno-compatible.
2. **Language mismatch:** LangGraph, CrewAI, AG2, Pydantic AI, and Claude Agent SDK are all Python. Woodhouse is TypeScript/Next.js.
3. **Paradigm mismatch:** Agent frameworks assume the LLM controls the flow. Woodhouse's flow is deterministic.
4. **Complexity mismatch:** Woodhouse needs structured LLM calls within a fixed pipeline, not autonomous agent loops.

The one exception is **Mastra**, which is TypeScript-native and integrates with Next.js. It's a reasonable choice if you want a framework, but for Woodhouse's deterministic pipeline, it adds abstraction without proportional benefit.

---

## 5. The "No Framework" Approach: 12-Factor Agents

The 12-Factor Agents methodology (by Dex Horthy / HumanLayer, 2025) emerged from analyzing 100+ production agent implementations. Its core finding: **"the most successful agents aren't the most 'agentic' — they're well-engineered software systems that leverage LLMs for specific, controlled transformations."**

### The 12 Factors Applied to Woodhouse

| Factor | Principle | Woodhouse Application |
|--------|-----------|----------------------|
| 1. Natural Language → Tool Calls | LLM outputs structured JSON, not free text | Every LLM call returns a typed JSON schema (evaluation scores, resume content, cover letter) |
| 2. Own Your Prompts | Control prompts directly, not through framework | System prompts for each pipeline step are versioned in code, not hidden behind abstractions |
| 3. Own Your Context Window | Deliberately manage what reaches the model | Each step sends only what it needs — evaluation gets job + profile, tailoring gets job + profile + evaluation |
| 4. Tools Are Just Structured Outputs | Define tools as JSON schemas | Not using tool-calling for Woodhouse — structured output with JSON mode is cleaner for this use case |
| 5. Unify Execution & Business State | Store agent state in application database | Pipeline state lives in Supabase tables (applications, evaluations, resume_versions) — not a separate agent memory |
| 6. Launch/Pause/Resume | Simple APIs for control flow | Pipeline steps are independent DB operations — can pause after any step and resume |
| 7. Contact Humans with Tool Calls | Human-in-the-loop as a standard pattern | The Review Queue is the human-in-the-loop step — built into the workflow, not an afterthought |
| 8. Own Your Control Flow | Write explicit loops, not framework magic | The pipeline orchestrator is a simple function: fetch → evaluate → tailor → generate → queue |
| 9. Compact Errors | Summarize failures concisely | Failed steps log the error and skip, don't crash the pipeline |
| 10. Small, Focused Agents | Specialized agents with narrow responsibilities | Each pipeline step has one job: parse, evaluate, tailor, or generate |
| 11. Trigger from Anywhere | Decouple triggering from execution | Pipeline triggers from cron, manual input, or email webhook — same execution logic |
| 12. Stateless Reducer | Agent as pure function | Each step reads from DB, processes, writes to DB — no mutable internal state |

### The Anti-Framework Argument

The 12-Factor approach warns: **"Stop letting frameworks hide your control flow."** The concern is:

- Frameworks create extra abstraction layers that obscure prompts and responses
- They make debugging harder when things go wrong
- They tempt you to add complexity when a simpler setup would work
- Most production customer-facing agents don't use agent frameworks

**Both Anthropic and OpenAI explicitly state: you do not always need agents. In many cases, workflows are simpler, more reliable, cheaper, faster, and more performant.**

Anthropic's recommendation: "Start by using LLM APIs directly — many patterns can be implemented in a few lines of code."

### The "90% Deterministic" Insight

From HumanLayer's analysis of their own production deployment bot: **"Most production agents aren't that agentic at all — they're 90% deterministic software with small, carefully controlled LLM interactions."**

This perfectly describes Woodhouse. The discovery step is 100% deterministic (API calls + parsing). The threshold check is 100% deterministic. File generation is 100% deterministic. Notification is 100% deterministic. The LLM only touches evaluation, tailoring, and generation — 3 out of ~8 pipeline steps.

---

## 6. Durable Execution Platforms

If agent frameworks are the wrong tool, what handles the hard operational problems — scheduling, retries, state management, error recovery?

### Option A: Supabase Queue Pattern (Simplest — Recommended for MVP)

**How it works:** Use Supabase tables as job queues, pg_cron to trigger Edge Functions, and database state for progress tracking.

**Architecture:**
```
pg_cron (schedule)
  → net.http_post (invoke Edge Function)
    → Edge Function reads pending items from queue table
      → Processes one item
      → Updates status in database
      → Returns
  → pg_cron invokes again on next tick
```

**Pros:**
- Zero additional infrastructure — uses what you already have (Supabase + Edge Functions)
- Battle-tested pattern — Supabase documents this officially
- Simple debugging — all state is in Postgres, queryable with SQL
- Multi-tenant natural — each user's jobs are rows in the same table
- Cost: $0 additional — included in Supabase plan

**Cons:**
- Edge Functions have 150-second timeout (sufficient for single LLM calls, tight for complex steps)
- No built-in retry logic (must implement in application code)
- No built-in observability (must add logging/monitoring)
- Queue processing is pull-based (cron polls), not push-based

**Implementation pattern:**
```
-- Queue table
CREATE TABLE public.pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  job_posting_id UUID,
  step TEXT NOT NULL, -- 'evaluate', 'tailor', 'generate_materials', 'generate_files'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  input_data JSONB,
  output_data JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- pg_cron trigger (every 30 seconds)
SELECT cron.schedule(
  'process-pipeline',
  '30 seconds',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-pipeline',
    headers := '{"Authorization": "Bearer service-role-key"}'
  )$$
);
```

**Edge Function pattern:**
```typescript
// process-pipeline Edge Function
const { data: job } = await supabase
  .from('pipeline_jobs')
  .select('*')
  .eq('status', 'pending')
  .lt('attempts', 3)
  .order('created_at', { ascending: true })
  .limit(1)
  .single();

if (!job) return new Response('No pending jobs');

// Mark as processing
await supabase.from('pipeline_jobs')
  .update({ status: 'processing', started_at: new Date(), attempts: job.attempts + 1 })
  .eq('id', job.id);

try {
  const result = await processStep(job.step, job.input_data);
  await supabase.from('pipeline_jobs')
    .update({ status: 'completed', output_data: result, completed_at: new Date() })
    .eq('id', job.id);

  // Enqueue next step if applicable
  await enqueueNextStep(job, result);
} catch (error) {
  await supabase.from('pipeline_jobs')
    .update({ status: job.attempts + 1 >= job.max_attempts ? 'failed' : 'pending', error: error.message })
    .eq('id', job.id);
}
```

### Option B: Trigger.dev (Best Upgrade Path)

**How it works:** Trigger.dev is a TypeScript-first background job platform with native Supabase + Next.js integration. Jobs are defined as TypeScript functions with built-in retries, queues, and observability.

**Architecture:**
```
Trigger (cron schedule OR Supabase DB change)
  → Trigger.dev Cloud (manages execution)
    → Your TypeScript function runs with full Node.js runtime
      → No timeout limits (runs as long as needed)
      → Built-in retries, queues, and rate limiting
      → Full observability dashboard
```

**Pros:**
- TypeScript-native — jobs are regular TypeScript functions
- Native Supabase integration (trigger on DB changes)
- Native Next.js integration
- No timeout limits (unlike Edge Functions)
- Built-in retries, rate limiting, concurrency control
- Full observability dashboard (logs, traces, metrics)
- Human-in-the-loop support with waitForEvent
- Can stream AI responses to frontend

**Cons:**
- Additional service dependency
- Free tier: 50,000 runs/month (may be sufficient for MVP)
- Paid: $50/month for 500,000 runs
- Runs on Trigger.dev cloud (not self-hosted on free tier)

**Implementation pattern:**
```typescript
// trigger/discovery-pipeline.ts
import { task, schedules } from "@trigger.dev/sdk/v3";

export const discoveryPipeline = schedules.task({
  id: "discovery-pipeline",
  cron: "0 */6 * * *", // Every 6 hours
  run: async (payload) => {
    const users = await getActiveUsers();

    for (const user of users) {
      await discoverJobs.trigger({ userId: user.id });
    }
  },
});

export const discoverJobs = task({
  id: "discover-jobs",
  retry: { maxAttempts: 3 },
  run: async ({ userId }) => {
    // Step 1: Fetch from all sources in parallel
    const postings = await Promise.all([
      fetchGoogleJobs(userId),
      fetchJSearch(userId),
      fetchGreenhouseBoards(userId),
    ]);

    // Step 2: Deduplicate and save
    const newPostings = await deduplicateAndSave(postings.flat());

    // Step 3: Evaluate each new posting
    for (const posting of newPostings) {
      await evaluateJob.trigger({ userId, postingId: posting.id });
    }
  },
});

export const evaluateJob = task({
  id: "evaluate-job",
  retry: { maxAttempts: 3 },
  queue: { concurrencyLimit: 5 }, // Max 5 concurrent evaluations
  run: async ({ userId, postingId }) => {
    const [profile, posting] = await Promise.all([
      getProfile(userId),
      getJobPosting(postingId),
    ]);

    const evaluation = await callClaude("evaluate", { profile, posting });
    await saveEvaluation(evaluation);

    if (evaluation.passes_threshold) {
      await tailorResume.trigger({ userId, postingId, evaluationId: evaluation.id });
    }
  },
});
```

### Option C: Inngest (Alternative to Trigger.dev)

**How it works:** Serverless, event-driven workflow orchestration. Functions are invoked via HTTP by the Inngest platform.

**Key features:**
- AgentKit for multi-agent orchestration
- step.ai for LLM call management
- step.ai.infer() offloads LLM requests to Inngest infrastructure (removes serverless timeout constraints)
- Network-based multi-agent routing

**Pros:**
- Serverless-first (great for Vercel)
- step.ai.infer() solves the timeout problem elegantly
- AgentKit if you want to evolve toward more agentic patterns later
- SQL-queryable observability (Insights)

**Cons:**
- Less native Supabase integration than Trigger.dev
- Newer platform, smaller community
- Pricing: Free (unlimited steps, limited concurrency), Pro ($50/mo)

### Option D: Temporal (Enterprise-Grade — Overkill for MVP)

**How it works:** Durable execution engine where workflows are deterministic orchestration code and activities are non-deterministic work (LLM calls, API calls).

**Key insight:** "While Temporal requires that your Workflow code is deterministic, your AI Agent can absolutely make decisions based on non-deterministic LLM outcomes." The Event History records all decisions, enabling perfect recovery without re-executing LLM calls.

**Notable:** OpenAI uses Temporal for Codex (their coding agent) in production.

**Pros:**
- Most battle-tested durable execution platform
- Perfect state recovery after failures (no wasted LLM calls on retry)
- Infinite execution duration
- TypeScript SDK available

**Cons:**
- Significant operational complexity (cluster management or cloud service)
- Self-hosted requires Cassandra/MySQL + Elasticsearch
- Temporal Cloud: $200/month minimum
- Massive overkill for Woodhouse's pipeline complexity
- Steep learning curve (workflows must be deterministic, activities are non-deterministic)

### Durable Execution Platform Comparison

| Feature | Supabase Queue | Trigger.dev | Inngest | Temporal |
|---------|---------------|-------------|---------|----------|
| **Complexity** | Simple | Moderate | Moderate | High |
| **Language** | TypeScript (Edge) | TypeScript | TypeScript | TypeScript/Go/Java |
| **Timeout** | 150s (Edge Fn) | Unlimited | Unlimited (step.ai) | Unlimited |
| **Retries** | Manual | Built-in | Built-in | Built-in + replay |
| **Observability** | DIY (logging) | Dashboard | Insights | Full tracing |
| **Supabase Integration** | Native | Native (DB triggers) | Manual | Manual |
| **Next.js Integration** | Via API routes | Native | Via SDK | Via SDK |
| **Multi-tenant** | Natural (DB rows) | Queue per tenant | Event routing | Namespace isolation |
| **Cost** | $0 (included) | Free → $50/mo | Free → $50/mo | $200+/mo |
| **Best for** | MVP | Growth stage | Growth stage | Enterprise |

---

## 7. Architecture Options for Woodhouse

Based on all research, here are three viable architecture options for Woodhouse, ranked by recommendation:

### Option 1: Supabase Queue + Direct Anthropic API (RECOMMENDED for MVP)

```
┌─────────────────────────────────────────────────────┐
│                    pg_cron                           │
│  ┌───────────────────────────────────────────────┐  │
│  │ Every 30s: process-pipeline                   │  │
│  │ Every 6h per user: trigger-discovery          │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ net.http_post
                       ▼
┌─────────────────────────────────────────────────────┐
│              Supabase Edge Functions                 │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Process  │  │ Discover │  │ Generate Files   │  │
│  │ Pipeline │  │ Jobs     │  │ (PDF/DOCX)       │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                  │            │
│       ▼              ▼                  ▼            │
│  ┌──────────────────────────────────────────────┐   │
│  │        Anthropic API (Direct SDK)            │   │
│  │  Haiku: parsing  |  Sonnet: eval/tailor/gen  │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Supabase Postgres                       │
│                                                     │
│  pipeline_jobs (queue table)                        │
│  job_postings | evaluations | applications          │
│  resume_versions | profiles | ...                   │
└─────────────────────────────────────────────────────┘
```

**How it works:**
1. pg_cron triggers a discovery Edge Function per user (every 6h, configurable).
2. Discovery function fetches jobs from APIs, saves new postings, enqueues evaluation jobs in `pipeline_jobs` table.
3. A process-pipeline Edge Function runs every 30 seconds, picks up pending jobs, processes one at a time.
4. Each job calls Claude directly via the Anthropic TypeScript SDK — no framework.
5. Completed jobs enqueue the next step. Failed jobs increment `attempts` and retry on next tick.
6. All state is in Postgres. Dashboard reads directly from application tables.

**LLM call pattern (direct, no framework):**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function evaluateJob(profile: Profile, posting: JobPosting): Promise<Evaluation> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: EVALUATION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: formatEvaluationPrompt(profile, posting)
    }],
    // Force structured JSON output
    response_format: { type: 'json' }
  });

  return parseEvaluationResponse(response);
}
```

**Pros:**
- Simplest architecture. Zero additional services.
- All state in Postgres. Queryable, debuggable, auditable.
- Full control over prompts, context windows, and LLM calls.
- Follows 12-Factor Agents principles perfectly.
- $0 infrastructure cost beyond existing Supabase plan.
- Can upgrade to Option 2 later without rewriting business logic.

**Cons:**
- 150-second Edge Function timeout (sufficient for single LLM calls but tight for complex steps).
- Must build retry logic, error tracking, and observability yourself.
- No built-in dashboard for job monitoring (build a simple admin view or use Supabase dashboard).

**Risk mitigation for 150s timeout:**
- Each pipeline step is a separate Edge Function invocation processing ONE item.
- Claude Sonnet calls typically complete in 5-30 seconds.
- If a single call approaches timeout, implement streaming responses and save partial results.

---

### Option 2: Trigger.dev + Direct Anthropic API (RECOMMENDED for Growth)

Same LLM call pattern as Option 1, but replace the Supabase queue with Trigger.dev for orchestration.

**When to upgrade from Option 1 to Option 2:**
- Pipeline complexity increases (more steps, conditional branches)
- Need unlimited execution time (e.g., for auto-submit browser automation in Phase 2)
- Need better observability without building it
- Need concurrency control per user
- Processing volume exceeds what 30-second polling can handle efficiently

**What changes:**
- Pipeline_jobs table is replaced by Trigger.dev task queue
- pg_cron is replaced by Trigger.dev schedules
- Edge Functions become Trigger.dev tasks (run on Trigger.dev infrastructure, no timeout)
- LLM calls and business logic stay the same

**What stays the same:**
- All application data in Supabase Postgres
- Direct Anthropic API calls (no framework)
- All prompts owned by your code
- Frontend, auth, storage unchanged

---

### Option 3: Mastra Framework + Supabase (ALTERNATIVE if you want a framework)

If you want a TypeScript agent framework despite the "no framework" recommendation, Mastra is the only viable choice.

```typescript
import { Agent } from '@mastra/core/agent';

const evaluationAgent = new Agent({
  id: 'job-evaluator',
  name: 'Job Evaluator',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: EVALUATION_SYSTEM_PROMPT,
  tools: { evaluateJobFit },
});

const tailoringAgent = new Agent({
  id: 'resume-tailor',
  name: 'Resume Tailor',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: TAILORING_SYSTEM_PROMPT,
  tools: { tailorResume, validateTruthfulness },
});
```

**When this makes sense:**
- You plan to evolve toward more agentic behavior (e.g., agent decides which jobs to apply to based on past success patterns)
- You want built-in structured output validation (Zod schemas)
- You value the framework's agent abstractions for team onboarding
- You want to use Mastra's workflow engine for the pipeline orchestration

**When this doesn't make sense:**
- You want maximum control and transparency
- You don't want framework lock-in
- Your pipeline remains deterministic (no LLM-driven control flow)

---

## 8. Recommended Architecture

### For MVP: Option 1 — Supabase Queue + Direct Anthropic API

**Rationale:**
1. **Simplest possible architecture** that solves the problem. Start simple, add complexity only when needed.
2. **Zero additional infrastructure.** Everything runs on Supabase + Vercel, which you already have.
3. **Full control.** Own your prompts, context windows, and control flow. Debug by querying Postgres.
4. **Aligned with industry consensus.** Anthropic says "start with LLM APIs directly." 12-Factor Agents says "own your control flow." The data says workflows beat agents for deterministic pipelines.
5. **Easy upgrade path.** When you outgrow the queue pattern, swap in Trigger.dev without rewriting business logic.

### Pipeline Implementation Architecture

```
User's scheduled run triggers:
│
├── Discovery Phase (Edge Function: discover-jobs)
│   ├── Fetch Google Jobs API (SerpAPI)     ─┐
│   ├── Fetch JSearch API                    ├── Parallel
│   ├── Fetch Greenhouse boards              │
│   └── Fetch Lever boards                  ─┘
│   ├── Deduplicate against existing postings
│   ├── Save new postings to job_postings table
│   └── Enqueue evaluation jobs for each new posting
│
├── Evaluation Phase (Edge Function: process-pipeline, step=evaluate)
│   ├── Read job posting + user profile from DB
│   ├── Call Claude Sonnet → structured JSON evaluation
│   ├── Save evaluation to job_evaluations table
│   ├── IF passes_threshold:
│   │   ├── Create application record (status=draft)
│   │   └── Enqueue tailoring job
│   └── ELSE: save evaluation only (visible in dashboard)
│
├── Tailoring Phase (Edge Function: process-pipeline, step=tailor)
│   ├── Read job posting + evaluation + full knowledge base from DB
│   ├── Call Claude Sonnet → structured JSON tailored resume
│   ├── Validate: every item traces to a knowledge base entry
│   ├── Save resume_version to DB
│   └── Enqueue materials generation job
│
├── Materials Phase (Edge Function: process-pipeline, step=generate_materials)
│   ├── Read job posting + evaluation + tailored resume from DB
│   ├── Call Claude Sonnet → cover letter + application answers
│   ├── Update application record with materials
│   ├── Set application status = 'ready'
│   └── Enqueue file generation job
│
├── File Generation Phase (Edge Function: generate-files)
│   ├── Read resume_version content_json from DB
│   ├── Generate PDF (using @react-pdf/renderer)
│   ├── Generate DOCX (using docx library)
│   ├── Upload to Supabase Storage
│   └── Update resume_version with file URLs
│
└── Notification Phase (programmatic, no LLM)
    ├── Create notification record
    └── Send email digest if configured
```

### Model Routing Strategy

| Task | Model | Reasoning | Est. Cost per Call |
|------|-------|-----------|-------------------|
| Job description parsing | Haiku 4.5 | Structured extraction, no reasoning needed | ~$0.001 |
| Email parsing | Haiku 4.5 | Structured extraction | ~$0.001 |
| Job evaluation | Sonnet 4.6 | Requires reasoning, scoring, explanation | ~$0.01-0.03 |
| Resume tailoring | Sonnet 4.6 | Requires reasoning, writing quality | ~$0.02-0.05 |
| Cover letter generation | Sonnet 4.6 | Requires quality writing | ~$0.01-0.03 |
| Application answers | Haiku 4.5 | Simple extraction from profile | ~$0.002 |
| Achievement improvement (AI assist) | Sonnet 4.6 | Writing quality matters | ~$0.005 |
| Skill suggestion (AI assist) | Haiku 4.5 | Simple analysis | ~$0.002 |

### Structured Output Pattern

Every LLM call uses structured output to ensure reliability:

```typescript
// Example: Evaluation call with structured output
const evaluationSchema = {
  overall_score: "integer 0-100",
  skill_score: "integer 0-100",
  experience_score: "integer 0-100",
  seniority_score: "integer 0-100",
  location_score: "integer 0-100",
  technology_score: "integer 0-100",
  recommendation: "one of: strong_match, good_match, possible_match, weak_match, no_match",
  reasoning: "string, 2-3 paragraphs",
  strengths: "array of strings",
  gaps: "array of strings"
};

// System prompt ends with:
// "Respond with ONLY a valid JSON object matching this schema: ..."
// Then parse and validate with Zod on the application side.
```

### Error Handling Strategy

```
For each pipeline step:
  1. Claim job (set status=processing, increment attempts)
  2. Try processing
  3. On success: set status=completed, enqueue next step
  4. On failure:
     a. If attempts < max_attempts: set status=pending (will retry on next tick)
     b. If attempts >= max_attempts: set status=failed, log error
     c. Failed jobs don't block the pipeline for other jobs
  5. Finally: always update the job record (prevent zombie jobs)
```

### Concurrency Control Pattern

Use Postgres `SELECT FOR UPDATE SKIP LOCKED` to prevent duplicate processing when multiple cron ticks overlap:

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

### Retry State Machine

Implement exponential backoff directly in Postgres:

```sql
ALTER TABLE pipeline_jobs ADD COLUMN IF NOT EXISTS
  next_retry_at TIMESTAMPTZ;

-- On failure, set next retry with exponential backoff
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

After 3 failures: 30s → 60s → 120s backoff, then marked as `failed` with notification to user.

### Zod Validation for All Agent Outputs

Every LLM response must be validated before writing to the database:

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
  // Log validation error, retry with clearer prompt, or mark as failed
  throw new ValidationError(`Evaluation output invalid: ${parsed.error.message}`);
}
```

Track validation failure rate as a key metric — should be <1% in production.

### Observability (DIY for MVP)

**Recommended: Langfuse** (open-source LLM observability, self-hostable or cloud). Add to every Anthropic SDK call:

```typescript
// Wrap every agent call with observability
async function callAgent(agentType: string, input: any, userId: string) {
  const start = Date.now();
  const trace = langfuse.trace({ name: agentType, userId });

  try {
    const result = await executeAgent(agentType, input);
    const duration = Date.now() - start;

    trace.update({
      output: result,
      metadata: {
        duration_ms: duration,
        input_tokens: result.usage?.input_tokens,
        output_tokens: result.usage?.output_tokens,
        model: result.model,
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

This gives you LangSmith-equivalent observability (per-agent cost analysis, error rates, latency percentiles) without any framework dependency.

**Additional observability layers:**
1. **Sentry** for error tracking with context (function name, step, user ID, job posting ID)
2. **Pipeline dashboard** — admin view querying pipeline_jobs table (counts by status, error rates, avg duration)
3. **Cost dashboard** — aggregate token usage per user, per agent, per day

### The Blackboard Pattern

The research identified Woodhouse's architecture as a classic **Blackboard pattern** — one of the oldest and most reliable multi-agent coordination approaches in AI. Agents read from and write to a shared knowledge base (the Postgres database), and a controller (the orchestrator) manages the sequence. This is not a limitation — it's a well-proven architecture that maps perfectly to the problem.

---

## 9. Cost Analysis

### Per-Application Cost Estimate

For one job passing through the full pipeline:

| Step | Model | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|------|-------|------------------|-------------------|-----------|
| Job parsing | Haiku 4.5 | ~2,000 | ~500 | $0.001 |
| Evaluation | Sonnet 4.6 | ~4,000 | ~1,500 | $0.025 |
| Resume tailoring | Sonnet 4.6 | ~6,000 | ~2,000 | $0.035 |
| Cover letter | Sonnet 4.6 | ~3,000 | ~800 | $0.015 |
| App answers | Haiku 4.5 | ~1,500 | ~500 | $0.001 |
| **Total per application** | | | | **~$0.08** |

### Monthly Cost Projections

| Scenario | Jobs Scanned | Applications Prepared | LLM Cost | Supabase | Vercel | Total |
|----------|-------------|----------------------|----------|----------|--------|-------|
| Single user (free) | 500 | 5 | $0.90 | $0 (free tier) | $0 (free) | ~$1 |
| Single user (pro) | 500 | 50 | $5.50 | $0 | $0 | ~$6 |
| 100 users (mixed) | 50,000 | 2,000 | $210 | $25 (Pro) | $20 (Pro) | ~$255 |
| 1,000 users (mixed) | 500,000 | 15,000 | $1,550 | $25 | $20 | ~$1,595 |
| 10,000 users (mixed) | 5,000,000 | 100,000 | $10,500 | $599 (Team) | $100 | ~$11,200 |

**Note:** Evaluation runs on ALL discovered jobs (including those below threshold), so scanning cost is dominated by evaluation, not parsing.

### Cost Optimization Strategies

1. **Prompt caching (highest impact):** Anthropic's prompt caching bills cached tokens at ~10% of normal input cost. The user's full profile (~3,000 tokens) is identical across every evaluation in a single run. With caching, evaluating 20 jobs costs: 1 full profile send + 19 cached sends. **Estimated savings: 58% reduction per evaluation run.** This should be implemented from day one.

2. **Progressive evaluation with Haiku pre-screen:** Before sending to Sonnet ($0.012/eval), run a quick Haiku pre-screen ($0.001) checking title/location/seniority match. Only send to Sonnet if the pre-screen passes. **Could cut evaluation costs by 50-70%.**

3. **Cache evaluations:** If a job posting hasn't changed and the user's profile hasn't changed, don't re-evaluate. Use a content hash to detect changes.

4. **Batch parsing with Haiku:** Parse multiple job descriptions in a single Haiku call (cheaper per token in batch).

5. **Prompt optimization:** Shorter, more focused prompts reduce token usage. Measure and iterate.

6. **Skip irrelevant sources:** If a user's match rate from a particular source is <5%, reduce scan frequency for that source.

7. **Anthropic Batch API for non-urgent work:** Off-peak tailoring/materials can use the batch API at 40-50% discount. Requires decoupling urgent (user-triggered) vs. batch (pipeline) work.

### Premium Tier Economics Warning

The data researcher flagged a critical pricing concern: at 10,000 users with heavy Premium usage, API costs could exceed revenue. Specifically:

- **Free tier:** ~$3/user/month API cost, $0 revenue (acceptable loss leader)
- **Pro tier ($19/mo):** ~$6-9/user/month API cost (53% gross margin — healthy)
- **Premium tier ($39/mo) heavy user:** ~$36/user/month API cost (7% gross margin — dangerous)

**Recommendation:** Either cap Premium at 200 applications/month (not truly "unlimited"), raise Premium to $59-79/month, or implement the cost optimizations above before launch to bring per-application cost down to ~$0.03-0.04.

---

## 10. Implementation Roadmap

### Phase 1: MVP (Supabase Queue Pattern)

1. **Build the pipeline_jobs queue table and process-pipeline Edge Function**
2. **Implement each step as a standalone function:**
   - `parseJobPosting(source, rawData) → structuredPosting`
   - `evaluateJobFit(profile, posting) → evaluation`
   - `tailorResume(profile, posting, evaluation) → resumeContent`
   - `generateMaterials(profile, posting, evaluation, resume) → materials`
   - `generateResumeFiles(resumeContent) → { pdfUrl, docxUrl }`
3. **Set up pg_cron schedules** for discovery and pipeline processing
4. **Add error handling** — retry logic, max attempts, error logging
5. **Build basic observability** — pipeline status admin view, Sentry integration

### Phase 2: Growth (Evaluate Trigger.dev Migration)

When you hit any of these triggers, migrate to Trigger.dev:
- Edge Function timeouts become a bottleneck
- Need concurrent processing with rate limiting per user
- Need better observability without building it
- Preparing for auto-submit (needs longer execution time for browser automation)

Migration is clean because business logic (LLM calls, data processing) stays the same — only the orchestration layer changes.

### Phase 3: Intelligence (Optional Agentic Enhancement)

Once you have enough data (thousands of applications, hundreds of outcomes):
- Add a "strategy agent" that analyzes which resume versions generate interviews
- Add a "recommendation agent" that suggests jobs based on past success patterns
- This is when you might introduce Mastra or an agentic pattern — when the LLM needs to make decisions about what to do, not just execute within a predetermined step

---

## 11. Sources

### Agent Architecture Patterns
- [Building Effective Agents — Anthropic Research](https://www.anthropic.com/research/building-effective-agents)
- [AI Agents vs AI Workflows: Why Pipelines Dominate in 2025 — IntuitionLabs](https://intuitionlabs.ai/articles/ai-agent-vs-ai-workflow)
- [12-Factor Agents — HumanLayer (GitHub)](https://github.com/humanlayer/12-factor-agents)
- [12-Factor Agents: Patterns of Reliable LLM Applications — DZone](https://dzone.com/articles/understanding-twelve-factor-agents)

### Framework Comparisons
- [Definitive Guide to Agentic Frameworks in 2026 — SoftmaxData](https://blog.softmaxdata.com/definitive-guide-to-agentic-frameworks-in-2026-langgraph-crewai-ag2-openai-and-more/)
- [LangGraph vs CrewAI vs OpenAI Agents SDK: Choosing Your Agent Framework in 2026 — Particula](https://particula.tech/blog/langgraph-vs-crewai-vs-openai-agents-sdk-2026)
- [CrewAI vs LangGraph vs AutoGen vs OpenAgents (2026) — OpenAgents](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)
- [AI Agent Frameworks Complete Guide 2026 — Calmops](https://calmops.com/ai/ai-agent-frameworks-comparison-2026/)
- [Top AI Agent Frameworks in 2025 — Codecademy](https://www.codecademy.com/article/top-ai-agent-frameworks-in-2025)

### Claude / Anthropic
- [Building Agents with the Claude Agent SDK — Anthropic Engineering](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Advanced Tool Use — Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use)
- [Claude Agent SDK Python — GitHub](https://github.com/anthropics/claude-agent-sdk-python)

### Durable Execution Platforms
- [Of Course You Can Build Dynamic AI Agents with Temporal — Temporal Blog](https://temporal.io/blog/of-course-you-can-build-dynamic-ai-agents-with-temporal)
- [Orchestrating Ambient Agents with Temporal — Temporal Blog](https://temporal.io/blog/orchestrating-ambient-agents-with-temporal)
- [AI Orchestration with AgentKit and step.ai — Inngest Blog](https://www.inngest.com/blog/ai-orchestration-with-agentkit-step-ai)
- [Inngest vs Temporal — Akka.io](https://akka.io/blog/inngest-vs-temporal)
- [Trigger.dev — Official Site](https://trigger.dev/)
- [Bringing Supabase Support to Trigger.dev — Trigger.dev Blog](https://trigger.dev/blog/introducing-supabase-integration)

### Supabase Patterns
- [Processing Large Jobs with Edge Functions, Cron, and Queues — Supabase Blog](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
- [Supabase Cron Documentation](https://supabase.com/docs/guides/cron)
- [Scheduling Edge Functions — Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions)

### Mastra
- [Mastra — Official Site](https://mastra.ai/)
- [Using Agents — Mastra Docs](https://mastra.ai/docs/agents/overview)
- [Mastra AI — Y Combinator](https://www.ycombinator.com/companies/mastra)

### Resume/Job AI Architecture
- [AI Hiring with LLMs: Multi-Agent Framework for Resume Screening — arXiv](https://arxiv.org/html/2504.02870v1)
- [Best LLM for Resume and Job Description Matching — PitchMeAI](https://pitchmeai.com/blog/best-llm-resume-job-description-matching)
