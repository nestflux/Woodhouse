"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createAchievement(data: {
  work_experience_id: string;
  description: string;
  metrics?: string;
  skills?: string[];
  sort_order?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.description.trim()) {
    return { error: "Achievement description is required" };
  }

  // Verify the work experience belongs to this user
  const { data: we } = await supabase
    .from("work_experiences")
    .select("id")
    .eq("id", data.work_experience_id)
    .eq("profile_id", user.id)
    .single();

  if (!we) return { error: "Work experience not found" };

  const { data: result, error } = await supabase
    .from("achievements")
    .insert({
      work_experience_id: data.work_experience_id,
      description: data.description.trim(),
      metrics: data.metrics?.trim() || null,
      skills: data.skills ?? [],
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true, data: result };
}

export async function updateAchievement(
  id: string,
  data: {
    description?: string;
    metrics?: string;
    skills?: string[];
    sort_order?: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.description !== undefined)
    updateData.description = data.description.trim();
  if (data.metrics !== undefined)
    updateData.metrics = data.metrics?.trim() || null;
  if (data.skills !== undefined) updateData.skills = data.skills;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

  // RLS ensures only own achievements can be updated
  const { error } = await supabase
    .from("achievements")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteAchievement(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS ensures only own achievements can be deleted
  const { error } = await supabase
    .from("achievements")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}
