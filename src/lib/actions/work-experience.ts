"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getWorkExperiences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("work_experiences")
    .select("*, achievements(*)")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: false });

  return data ?? [];
}

export async function createWorkExperience(data: {
  company_name: string;
  job_title: string;
  location?: string;
  country?: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
  sort_order?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.company_name.trim() || !data.job_title.trim()) {
    return { error: "Company name and job title are required" };
  }
  if (!data.start_date) {
    return { error: "Start date is required" };
  }

  const { data: result, error } = await supabase
    .from("work_experiences")
    .insert({
      profile_id: user.id,
      company_name: data.company_name.trim(),
      job_title: data.job_title.trim(),
      location: data.location?.trim() || null,
      country: data.country?.trim() || null,
      start_date: data.start_date,
      end_date: data.is_current ? null : data.end_date || null,
      is_current: data.is_current ?? false,
      description: data.description?.trim() || null,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true, data: result };
}

export async function updateWorkExperience(
  id: string,
  data: {
    company_name?: string;
    job_title?: string;
    location?: string;
    country?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
    sort_order?: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.company_name !== undefined)
    updateData.company_name = data.company_name.trim();
  if (data.job_title !== undefined)
    updateData.job_title = data.job_title.trim();
  if (data.location !== undefined)
    updateData.location = data.location.trim() || null;
  if (data.country !== undefined)
    updateData.country = data.country.trim() || null;
  if (data.start_date !== undefined) updateData.start_date = data.start_date;
  if (data.is_current !== undefined) {
    updateData.is_current = data.is_current;
    if (data.is_current) updateData.end_date = null;
  }
  if (data.end_date !== undefined) updateData.end_date = data.end_date || null;
  if (data.description !== undefined)
    updateData.description = data.description.trim() || null;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

  const { error } = await supabase
    .from("work_experiences")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function reorderWorkExperiences(
  orderedIds: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("work_experiences")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("profile_id", user.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteWorkExperience(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("work_experiences")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}
