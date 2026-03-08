import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { captureException } from "../_shared/sentry.ts";

const WORKER_TIMEOUT_MS = 120_000;

interface PipelineJob {
  id: string;
  profile_id: string;
  job_posting_id: string | null;
  application_id: string | null;
  discovery_run_id: string | null;
  step: string;
  status: string;
  attempts: number;
  max_attempts: number;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
  created_at: string;
}

type StepHandler = (
  job: PipelineJob
) => Promise<{ nextStep?: string; outputData?: Record<string, unknown> }>;

const stepHandlers: Record<string, StepHandler> = {
  pre_screen: async (_job) => {
    // Stub: will be implemented in E5-01
    console.info(`[stub] pre_screen for job ${_job.id} — not yet implemented`);
    return { nextStep: "evaluate" };
  },
  evaluate: async (_job) => {
    // Stub: will be implemented in E6-01
    console.info(`[stub] evaluate for job ${_job.id} — not yet implemented`);
    return { nextStep: "tailor" };
  },
  tailor: async (_job) => {
    // Stub: will be implemented in E7-01
    console.info(`[stub] tailor for job ${_job.id} — not yet implemented`);
    return { nextStep: "generate_materials" };
  },
  generate_materials: async (_job) => {
    // Stub: will be implemented in E7-02
    console.info(
      `[stub] generate_materials for job ${_job.id} — not yet implemented`
    );
    return { nextStep: "generate_files" };
  },
  generate_files: async (_job) => {
    // Stub: will be implemented in E7-03
    console.info(
      `[stub] generate_files for job ${_job.id} — not yet implemented`
    );
    return {};
  },
};

async function completeJob(
  jobId: string,
  outputData?: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("pipeline_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_data: outputData ?? null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to complete job ${jobId}: ${error.message}`);
  }
}

async function enqueueNextStep(
  currentJob: PipelineJob,
  nextStep: string,
  extraData?: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pipeline_jobs").insert({
    profile_id: currentJob.profile_id,
    job_posting_id: currentJob.job_posting_id,
    application_id: currentJob.application_id,
    discovery_run_id: currentJob.discovery_run_id,
    step: nextStep,
    status: "pending",
    input_data: extraData ?? currentJob.output_data ?? null,
  });

  if (error) {
    throw new Error(
      `Failed to enqueue next step '${nextStep}' for job ${currentJob.id}: ${error.message}`
    );
  }
}

Deno.serve(async (_req) => {
  const startTime = Date.now();
  let jobsProcessed = 0;
  const supabase = getSupabaseAdmin();

  try {
    while (Date.now() - startTime < WORKER_TIMEOUT_MS) {
      // Claim a job using the DB function
      const { data: jobs, error: claimError } = await supabase.rpc(
        "claim_pipeline_job"
      );

      if (claimError) {
        console.error(`Failed to claim job: ${claimError.message}`);
        break;
      }

      if (!jobs || jobs.length === 0) {
        // No pending jobs — exit cleanly
        break;
      }

      const job = jobs[0] as PipelineJob;
      const jobStart = Date.now();

      console.info(
        `[worker] Processing step=${job.step} job_id=${job.id} profile_id=${job.profile_id} attempt=${job.attempts}`
      );

      try {
        const handler = stepHandlers[job.step];
        if (!handler) {
          throw new Error(`Unknown pipeline step: ${job.step}`);
        }

        const result = await handler(job);

        // Mark job as completed
        await completeJob(job.id, result.outputData);

        // Enqueue next step if specified
        if (result.nextStep) {
          await enqueueNextStep(job, result.nextStep, result.outputData);
        }

        const duration = Date.now() - jobStart;
        console.info(
          `[worker] Completed step=${job.step} job_id=${job.id} profile_id=${job.profile_id} duration=${duration}ms`
        );

        jobsProcessed++;
      } catch (error) {
        const duration = Date.now() - jobStart;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(
          `[worker] Failed step=${job.step} job_id=${job.id} profile_id=${job.profile_id} duration=${duration}ms error=${errorMessage}`
        );

        // Call fail_pipeline_job for exponential backoff
        const { error: failError } = await supabase.rpc("fail_pipeline_job", {
          p_job_id: job.id,
          p_error: errorMessage,
        });

        if (failError) {
          console.error(
            `Failed to mark job as failed: ${failError.message}`
          );
        }

        captureException(error, {
          jobId: job.id,
          step: job.step,
          profileId: job.profile_id,
          jobPostingId: job.job_posting_id,
          attempt: job.attempts,
        });
      }
    }
  } catch (error) {
    console.error(`[worker] Fatal error: ${error}`);
    captureException(error, { phase: "worker-loop" });
  }

  const totalDuration = Date.now() - startTime;
  console.info(
    `[worker] Finished. jobs_processed=${jobsProcessed} total_duration=${totalDuration}ms`
  );

  return new Response(
    JSON.stringify({
      jobs_processed: jobsProcessed,
      duration_ms: totalDuration,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
