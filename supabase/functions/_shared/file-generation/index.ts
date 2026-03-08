/**
 * Resume file generation orchestrator.
 *
 * Generates PDF + DOCX from resume_versions.content_json,
 * uploads to Supabase Storage, and updates the resume_versions record.
 */

import { getSupabaseAdmin } from "../supabase.ts";
import { RetryableError } from "../agent-call.ts";
import { captureException, captureMessage } from "../sentry.ts";
import { generateResumePdf } from "./resume-pdf.ts";
import { generateResumeDocx } from "./resume-docx.ts";
import type { ResumeContent } from "./types.ts";

/** Signed URL expiration: 30 days in seconds. */
const SIGNED_URL_EXPIRY = 30 * 24 * 60 * 60;

interface GenerateFilesInput {
  resumeVersionId: string;
  profileId: string;
}

interface GenerateFilesResult {
  pdfUrl: string;
  docxUrl: string;
  storagePdfPath: string;
  storageDocxPath: string;
}

export async function generateResumeFiles(
  input: GenerateFilesInput
): Promise<GenerateFilesResult> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch the resume version content
  const { data: resumeVersion, error: fetchError } = await supabase
    .from("resume_versions")
    .select("content_json, profile_id")
    .eq("id", input.resumeVersionId)
    .single();

  if (fetchError || !resumeVersion) {
    throw new RetryableError(
      `Failed to fetch resume version ${input.resumeVersionId}: ${fetchError?.message ?? "Not found"}`
    );
  }

  const content = resumeVersion.content_json as ResumeContent;
  if (
    !content ||
    !content.header?.full_name ||
    !content.summary ||
    !Array.isArray(content.work_experience)
  ) {
    throw new Error(
      `Resume version ${input.resumeVersionId} has invalid content_json — missing required fields`
    );
  }

  // 2. Generate PDF and DOCX in parallel
  const [pdfBytes, docxBytes] = await Promise.all([
    generateResumePdf(content).catch((err) => {
      captureException(err, {
        phase: "pdf-generation",
        resumeVersionId: input.resumeVersionId,
      });
      throw new RetryableError(`PDF generation failed: ${err.message}`);
    }),
    generateResumeDocx(content).catch((err) => {
      captureException(err, {
        phase: "docx-generation",
        resumeVersionId: input.resumeVersionId,
      });
      throw new RetryableError(`DOCX generation failed: ${err.message}`);
    }),
  ]);

  // 3. Upload to Supabase Storage
  const storagePdfPath = `${input.profileId}/${input.resumeVersionId}.pdf`;
  const storageDocxPath = `${input.profileId}/${input.resumeVersionId}.docx`;

  const [pdfUpload, docxUpload] = await Promise.all([
    supabase.storage.from("resumes").upload(storagePdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    }),
    supabase.storage.from("resumes").upload(storageDocxPath, docxBytes, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    }),
  ]);

  if (pdfUpload.error) {
    throw new RetryableError(
      `PDF upload failed: ${pdfUpload.error.message}`
    );
  }
  if (docxUpload.error) {
    throw new RetryableError(
      `DOCX upload failed: ${docxUpload.error.message}`
    );
  }

  // 4. Create signed URLs
  const [pdfSigned, docxSigned] = await Promise.all([
    supabase.storage
      .from("resumes")
      .createSignedUrl(storagePdfPath, SIGNED_URL_EXPIRY),
    supabase.storage
      .from("resumes")
      .createSignedUrl(storageDocxPath, SIGNED_URL_EXPIRY),
  ]);

  if (pdfSigned.error || !pdfSigned.data?.signedUrl) {
    captureMessage("Failed to create signed URL for PDF", {
      resumeVersionId: input.resumeVersionId,
      error: pdfSigned.error?.message,
    });
    throw new RetryableError(
      `Failed to create PDF signed URL: ${pdfSigned.error?.message ?? "No URL returned"}`
    );
  }

  if (docxSigned.error || !docxSigned.data?.signedUrl) {
    captureMessage("Failed to create signed URL for DOCX", {
      resumeVersionId: input.resumeVersionId,
      error: docxSigned.error?.message,
    });
    throw new RetryableError(
      `Failed to create DOCX signed URL: ${docxSigned.error?.message ?? "No URL returned"}`
    );
  }

  // 5. Update resume_versions with signed URLs
  const { error: updateError } = await supabase
    .from("resume_versions")
    .update({
      file_url_pdf: pdfSigned.data.signedUrl,
      file_url_docx: docxSigned.data.signedUrl,
    })
    .eq("id", input.resumeVersionId);

  if (updateError) {
    throw new RetryableError(
      `Failed to update resume_versions with file URLs: ${updateError.message}`
    );
  }

  return {
    pdfUrl: pdfSigned.data.signedUrl,
    docxUrl: docxSigned.data.signedUrl,
    storagePdfPath,
    storageDocxPath,
  };
}
