"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSearchPreferences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("search_preferences")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  return data;
}

export async function upsertSearchPreferences(data: {
  keywords?: string[];
  excluded_keywords?: string[];
  excluded_companies?: string[];
  preferred_company_sizes?: string[];
  preferred_industries?: string[];
  min_salary?: number | null;
  max_salary?: number | null;
  salary_currency?: string;
  job_types?: string[];
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const prefData: Record<string, unknown> = {
    profile_id: user.id,
    keywords: data.keywords ?? [],
    excluded_keywords: data.excluded_keywords ?? [],
    excluded_companies: data.excluded_companies ?? [],
    preferred_company_sizes: data.preferred_company_sizes ?? [],
    preferred_industries: data.preferred_industries ?? [],
    min_salary: data.min_salary ?? null,
    max_salary: data.max_salary ?? null,
    salary_currency: data.salary_currency ?? "USD",
    job_types: data.job_types ?? ["full_time"],
    is_active: data.is_active ?? true,
    next_discovery_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("search_preferences")
    .upsert(prefData, { onConflict: "profile_id" });

  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { success: true };
}

export async function updateProfilePreferences(data: {
  target_roles?: string[];
  target_locations?: string[];
  target_countries?: string[];
  remote_preference?: string;
  min_salary?: number | null;
  max_salary?: number | null;
  salary_currency?: string;
  match_threshold?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updateData: Record<string, unknown> = {};
  if (data.target_roles !== undefined)
    updateData.target_roles = data.target_roles;
  if (data.target_locations !== undefined)
    updateData.target_locations = data.target_locations;
  if (data.target_countries !== undefined)
    updateData.target_countries = data.target_countries;
  if (data.remote_preference !== undefined)
    updateData.remote_preference = data.remote_preference;
  if (data.min_salary !== undefined) updateData.min_salary = data.min_salary;
  if (data.max_salary !== undefined) updateData.max_salary = data.max_salary;
  if (data.salary_currency !== undefined)
    updateData.salary_currency = data.salary_currency;
  if (data.match_threshold !== undefined)
    updateData.match_threshold = data.match_threshold;

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { success: true };
}
