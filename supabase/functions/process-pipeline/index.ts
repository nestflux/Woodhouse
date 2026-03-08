import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { captureException } from "../_shared/sentry.ts";
import { runPreScreen } from "../_shared/agents/pre-screen.ts";
import { runEvaluation } from "../_shared/agents/evaluation.ts";
import { runTailoring } from "../_shared/agents/tailoring.ts";
import { runMaterials } from "../_shared/agents/materials.ts";
import { generateResumeFiles } from "../_shared/file-generation/index.ts";

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
  pre_screen: async (job) => {
    if (!job.job_posting_id) {
      throw new Error("pre_screen requires a job_posting_id");
    }

    const result = await runPreScreen({
      userId: job.profile_id,
      jobPostingId: job.job_posting_id,
    });

    const outputData = {
      pass: result.pass,
      reason: result.reason,
      disqualifiers: result.disqualifiers,
    };

    if (result.pass) {
      return { nextStep: "evaluate", outputData };
    }

    // Job failed pre-screen — mark completed, no evaluation record created
    return { outputData };
  },
  evaluate: async (job) => {
    if (!job.job_posting_id) {
      throw new Error("evaluate requires a job_posting_id");
    }

    const result = await runEvaluation({
      userId: job.profile_id,
      jobPostingId: job.job_posting_id,
    });

    const outputData = {
      evaluation_id: result.evaluationId,
      overall_score: result.evaluation.overall_score,
      recommendation: result.evaluation.recommendation,
      passes_threshold: result.passesThreshold,
      application_id: result.applicationId ?? null,
    };

    if (result.passesThreshold && result.applicationId) {
      // Pass threshold — enqueue tailoring with application_id
      return {
        nextStep: "tailor",
        outputData,
      };
    }

    // Below threshold — save evaluation only, no application or tailoring
    return { outputData };
  },
  tailor: async (job) => {
    if (!job.job_posting_id) {
      throw new Error("tailor requires a job_posting_id");
    }
    if (!job.application_id) {
      throw new Error("tailor requires an application_id");
    }

    const result = await runTailoring({
      userId: job.profile_id,
      jobPostingId: job.job_posting_id,
      applicationId: job.application_id,
    });

    const outputData = {
      resume_version_id: result.resumeVersionId,
      application_id: job.application_id,
    };

    return {
      nextStep: "generate_materials",
      outputData,
    };
  },
  generate_materials: async (job) => {
    if (!job.job_posting_id) {
      throw new Error("generate_materials requires a job_posting_id");
    }
    if (!job.application_id) {
      throw new Error("generate_materials requires an application_id");
    }

    await runMaterials({
      userId: job.profile_id,
      jobPostingId: job.job_posting_id,
      applicationId: job.application_id,
    });

    const outputData = {
      application_id: job.application_id,
    };

    return {
      nextStep: "generate_files",
      outputData,
    };
  },
  generate_files: async (job) => {
    if (!job.application_id) {
      throw new Error("generate_files requires an application_id");
    }

    const supabase = getSupabaseAdmin();

    // Find the tailored resume version for this application
    const { data: resumeVersion, error: rvError } = await supabase
      .from("resume_versions")
      .select("id")
      .eq("application_id", job.application_id)
      .eq("is_base", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (rvError || !resumeVersion) {
      throw new Error(
        `No tailored resume found for application ${job.application_id}: ${rvError?.message ?? "Not found"}`
      );
    }

    // Generate PDF + DOCX, upload to storage, update resume_versions
    const fileResult = await generateResumeFiles({
      resumeVersionId: resumeVersion.id,
      profileId: job.profile_id,
    });

    // Set application status to 'ready'
    const { error: statusError } = await supabase
      .from("applications")
      .update({ status: "ready" })
      .eq("id", job.application_id);

    if (statusError) {
      throw new Error(
        `Failed to update application status to ready: ${statusError.message}`
      );
    }

    // Notification is created automatically by the handle_application_ready() trigger

    return {
      outputData: {
        application_id: job.application_id,
        resume_version_id: resumeVersion.id,
        pdf_url: fileResult.pdfUrl,
        docx_url: fileResult.docxUrl,
        status: "ready",
      },
    };
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

  // Use application_id from output data if set (e.g., after evaluation creates one)
  const applicationId =
    (extraData?.application_id as string) ?? currentJob.application_id;

  const { error } = await supabase.from("pipeline_jobs").insert({
    profile_id: currentJob.profile_id,
    job_posting_id: currentJob.job_posting_id,
    application_id: applicationId,
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
        captureException(new Error(claimError.message), {
          phase: "claim-job",
        });
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
          captureException(new Error(failError.message), {
            phase: "fail-pipeline-job",
            jobId: job.id,
            step: job.step,
          });
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
