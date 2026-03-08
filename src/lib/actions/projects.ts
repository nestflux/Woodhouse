"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getProjects() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

export async function createProject(data: {
  name: string;
  description: string;
  url?: string;
  technologies?: string[];
  start_date?: string;
  end_date?: string;
  highlights?: string[];
  sort_order?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.name.trim() || !data.description.trim()) {
    return { error: "Project name and description are required" };
  }

  const { data: result, error } = await supabase
    .from("projects")
    .insert({
      profile_id: user.id,
      name: data.name.trim(),
      description: data.description.trim(),
      url: data.url?.trim() || null,
      technologies: data.technologies ?? [],
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      highlights: data.highlights ?? [],
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true, data: result };
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    description?: string;
    url?: string;
    technologies?: string[];
    start_date?: string;
    end_date?: string;
    highlights?: string[];
    sort_order?: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined)
    updateData.description = data.description.trim();
  if (data.url !== undefined) updateData.url = data.url?.trim() || null;
  if (data.technologies !== undefined)
    updateData.technologies = data.technologies;
  if (data.start_date !== undefined)
    updateData.start_date = data.start_date || null;
  if (data.end_date !== undefined)
    updateData.end_date = data.end_date || null;
  if (data.highlights !== undefined) updateData.highlights = data.highlights;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

  const { error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function getCertifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("certifications")
    .select("*")
    .eq("profile_id", user.id)
    .order("issue_date", { ascending: false, nullsFirst: true });

  return data ?? [];
}

export async function createCertification(data: {
  name: string;
  issuing_organization: string;
  issue_date?: string;
  expiry_date?: string;
  credential_url?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.name.trim() || !data.issuing_organization.trim()) {
    return { error: "Certification name and issuing organization are required" };
  }

  const { data: result, error } = await supabase
    .from("certifications")
    .insert({
      profile_id: user.id,
      name: data.name.trim(),
      issuing_organization: data.issuing_organization.trim(),
      issue_date: data.issue_date || null,
      expiry_date: data.expiry_date || null,
      credential_url: data.credential_url?.trim() || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true, data: result };
}

export async function updateCertification(
  id: string,
  data: {
    name?: string;
    issuing_organization?: string;
    issue_date?: string;
    expiry_date?: string;
    credential_url?: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.issuing_organization !== undefined)
    updateData.issuing_organization = data.issuing_organization.trim();
  if (data.issue_date !== undefined)
    updateData.issue_date = data.issue_date || null;
  if (data.expiry_date !== undefined)
    updateData.expiry_date = data.expiry_date || null;
  if (data.credential_url !== undefined)
    updateData.credential_url = data.credential_url?.trim() || null;

  const { error } = await supabase
    .from("certifications")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteCertification(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("certifications")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}
