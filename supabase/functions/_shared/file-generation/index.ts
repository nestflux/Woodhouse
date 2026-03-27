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
  resumeVersionId?: string;
  profileId: string;
  /** Direct content input — skips resume_versions lookup when provided. */
  directContent?: ResumeContent;
  /** User resume ID — used for storage path when generating from user_resumes. */
  userResumeId?: string;
  /** Formats to generate. Defaults to both PDF and DOCX. */
  formats?: ("pdf" | "docx")[];
}

interface GenerateFilesResult {
  pdfUrl: string | null;
  docxUrl: string | null;
  storagePdfPath: string | null;
  storageDocxPath: string | null;
}

export async function generateResumeFiles(
  input: GenerateFilesInput
): Promise<GenerateFilesResult> {
  const supabase = getSupabaseAdmin();
  const formats = input.formats ?? ["pdf", "docx"];
  const genPdf = formats.includes("pdf");
  const genDocx = formats.includes("docx");
  const sourceId = input.userResumeId ?? input.resumeVersionId;

  // 1. Resolve content — either direct or from resume_versions
  let content: ResumeContent;

  if (input.directContent) {
    content = input.directContent;
  } else if (input.resumeVersionId) {
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
    content = resumeVersion.content_json as ResumeContent;
  } else {
    throw new Error("Either directContent or resumeVersionId is required");
  }

  if (
    !content ||
    !content.header?.full_name ||
    !content.summary ||
    !Array.isArray(content.work_experience)
  ) {
    throw new Error(
      `Resume content has invalid structure — missing required fields`
    );
  }

  // 2. Generate files
  const pathPrefix = input.userResumeId
    ? `${input.profileId}/rb_${input.userResumeId}`
    : `${input.profileId}/${input.resumeVersionId}`;

  let pdfBytes: Uint8Array | null = null;
  let docxBytes: Uint8Array | null = null;

  const genPromises: Promise<void>[] = [];
  if (genPdf) {
    genPromises.push(
      generateResumePdf(content)
        .then((bytes) => { pdfBytes = bytes; })
        .catch((err) => {
          captureException(err, { phase: "pdf-generation", sourceId });
          throw new RetryableError(`PDF generation failed: ${err.message}`);
        })
    );
  }
  if (genDocx) {
    genPromises.push(
      generateResumeDocx(content)
        .then((bytes) => { docxBytes = bytes; })
        .catch((err) => {
          captureException(err, { phase: "docx-generation", sourceId });
          throw new RetryableError(`DOCX generation failed: ${err.message}`);
        })
    );
  }
  await Promise.all(genPromises);

  // 3. Upload to storage
  const storagePdfPath = genPdf ? `${pathPrefix}.pdf` : null;
  const storageDocxPath = genDocx ? `${pathPrefix}.docx` : null;

  const uploadPromises: Promise<void>[] = [];
  if (pdfBytes && storagePdfPath) {
    uploadPromises.push(
      supabase.storage
        .from("resumes")
        .upload(storagePdfPath, pdfBytes, { contentType: "application/pdf", upsert: true })
        .then(({ error }) => {
          if (error) throw new RetryableError(`PDF upload failed: ${error.message}`);
        })
    );
  }
  if (docxBytes && storageDocxPath) {
    uploadPromises.push(
      supabase.storage
        .from("resumes")
        .upload(storageDocxPath, docxBytes, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        })
        .then(({ error }) => {
          if (error) throw new RetryableError(`DOCX upload failed: ${error.message}`);
        })
    );
  }
  await Promise.all(uploadPromises);

  // 4. Create signed URLs
  let pdfUrl: string | null = null;
  let docxUrl: string | null = null;

  if (storagePdfPath) {
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(storagePdfPath, SIGNED_URL_EXPIRY);
    if (error || !data?.signedUrl) {
      captureMessage("Failed to create signed URL for PDF", { sourceId, error: error?.message });
      throw new RetryableError(`Failed to create PDF signed URL: ${error?.message ?? "No URL returned"}`);
    }
    pdfUrl = data.signedUrl;
  }

  if (storageDocxPath) {
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(storageDocxPath, SIGNED_URL_EXPIRY);
    if (error || !data?.signedUrl) {
      captureMessage("Failed to create signed URL for DOCX", { sourceId, error: error?.message });
      throw new RetryableError(`Failed to create DOCX signed URL: ${error?.message ?? "No URL returned"}`);
    }
    docxUrl = data.signedUrl;
  }

  // 5. Update the source record with signed URLs
  if (input.userResumeId) {
    const updates: Record<string, string | null> = {};
    if (pdfUrl) updates.file_url_pdf = pdfUrl;
    if (docxUrl) updates.file_url_docx = docxUrl;
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("user_resumes")
        .update(updates)
        .eq("id", input.userResumeId);
      if (updateError) {
        throw new RetryableError(`Failed to update user_resumes with file URLs: ${updateError.message}`);
      }
    }
  } else if (input.resumeVersionId) {
    const updates: Record<string, string | null> = {};
    if (pdfUrl) updates.file_url_pdf = pdfUrl;
    if (docxUrl) updates.file_url_docx = docxUrl;
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("resume_versions")
        .update(updates)
        .eq("id", input.resumeVersionId);
      if (updateError) {
        throw new RetryableError(`Failed to update resume_versions with file URLs: ${updateError.message}`);
      }
    }
  }

  return { pdfUrl, docxUrl, storagePdfPath, storageDocxPath };
}
