"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = [
  "technical",
  "soft",
  "language",
  "certification",
  "tool",
  "framework",
  "other",
] as const;

const VALID_PROFICIENCIES = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;

export async function getSkills() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("skills")
    .select("*")
    .eq("profile_id", user.id)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  return data ?? [];
}

export async function createSkill(data: {
  name: string;
  category?: string;
  proficiency?: string;
  years_experience?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.name.trim()) {
    return { error: "Skill name is required" };
  }

  const category = VALID_CATEGORIES.includes(
    data.category as (typeof VALID_CATEGORIES)[number]
  )
    ? data.category
    : "other";

  const proficiency = VALID_PROFICIENCIES.includes(
    data.proficiency as (typeof VALID_PROFICIENCIES)[number]
  )
    ? data.proficiency
    : "intermediate";

  const { data: result, error } = await supabase
    .from("skills")
    .insert({
      profile_id: user.id,
      name: data.name.trim(),
      category,
      proficiency,
      years_experience: data.years_experience ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true, data: result };
}

export async function updateSkill(
  id: string,
  data: {
    name?: string;
    category?: string;
    proficiency?: string;
    years_experience?: number | null;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.category !== undefined && VALID_CATEGORIES.includes(data.category as (typeof VALID_CATEGORIES)[number]))
    updateData.category = data.category;
  if (data.proficiency !== undefined && VALID_PROFICIENCIES.includes(data.proficiency as (typeof VALID_PROFICIENCIES)[number]))
    updateData.proficiency = data.proficiency;
  if (data.years_experience !== undefined)
    updateData.years_experience = data.years_experience;

  const { error } = await supabase
    .from("skills")
    .update(updateData)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteSkill(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("skills")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}

export async function createSkillsBatch(
  skills: {
    name: string;
    category?: string;
    proficiency?: string;
    years_experience?: number;
  }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const rows = skills
    .filter((s) => s.name.trim())
    .map((s) => ({
      profile_id: user.id,
      name: s.name.trim(),
      category: VALID_CATEGORIES.includes(
        s.category as (typeof VALID_CATEGORIES)[number]
      )
        ? s.category
        : "other",
      proficiency: VALID_PROFICIENCIES.includes(
        s.proficiency as (typeof VALID_PROFICIENCIES)[number]
      )
        ? s.proficiency
        : "intermediate",
      years_experience: s.years_experience ?? null,
    }));

  if (rows.length === 0) return { success: true };

  const { error } = await supabase.from("skills").insert(rows);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}
