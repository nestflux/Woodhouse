"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getEducation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("education")
    .select("*")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true })
    .order("end_date", { ascending: false, nullsFirst: true });

  return data ?? [];
}

export async function createEducation(data: {
  institution: string;
  degree: string;
  field_of_study: string;
  start_date?: string;
  end_date?: string;
  gpa?: number;
  achievements?: string[];
  sort_order?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (
    !data.institution.trim() ||
    !data.degree.trim() ||
    !data.field_of_study.trim()
  ) {
    return { error: "Institution, degree, and field of study are required" };
  }

  const { data: result, error } = await supabase
    .from("education")
    .insert({
      profile_id: user.id,
      institution: data.institution.trim(),
      degree: data.degree.trim(),
      field_of_study: data.field_of_study.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      gpa: data.gpa ?? null,
      achievements: data.achievements ?? [],
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true, data: result };
}

export async function updateEducation(
  id: string,
  data: {
    institution?: string;
    degree?: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
    gpa?: number | null;
    achievements?: string[];
    sort_order?: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.institution !== undefined)
    updateData.institution = data.institution.trim();
  if (data.degree !== undefined) updateData.degree = data.degree.trim();
  if (data.field_of_study !== undefined)
    updateData.field_of_study = data.field_of_study.trim();
  if (data.start_date !== undefined)
    updateData.start_date = data.start_date || null;
  if (data.end_date !== undefined)
    updateData.end_date = data.end_date || null;
  if (data.gpa !== undefined) updateData.gpa = data.gpa;
  if (data.achievements !== undefined)
    updateData.achievements = data.achievements;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

  const { error } = await supabase
    .from("education")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteEducation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("education")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}
