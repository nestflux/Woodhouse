"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Determine the last step the user completed based on what data exists.
 * Returns the path to the step they should resume from.
 */
export async function getResumeStep(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/onboarding/upload";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, headline, summary, resume_parsed_data")
    .eq("id", user.id)
    .single();

  // If no basic info beyond the auto-created name, start at upload
  if (!profile?.full_name || profile.full_name === user.user_metadata?.full_name) {
    // Check if they've moved past basics — do they have headline/summary?
    if (!profile?.headline && !profile?.summary) {
      return "/onboarding/upload";
    }
  }

  // Check if they have headline
  if (!profile?.headline) {
    return "/onboarding/basics";
  }

  // Check work experiences
  const { count: expCount } = await supabase
    .from("work_experiences")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  // Check education
  const { count: eduCount } = await supabase
    .from("education")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  // Check skills
  const { count: skillCount } = await supabase
    .from("skills")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  // Check search preferences
  const { data: prefs } = await supabase
    .from("search_preferences")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  // Walk through steps and find the first one without data
  // Users may intentionally skip steps, so we're lenient
  if ((expCount ?? 0) === 0 && (eduCount ?? 0) === 0) {
    return "/onboarding/experience";
  }
  if ((eduCount ?? 0) === 0 && (skillCount ?? 0) === 0) {
    return "/onboarding/education";
  }
  if ((skillCount ?? 0) === 0) {
    return "/onboarding/skills";
  }
  if (!prefs) {
    return "/onboarding/preferences";
  }

  // All steps have some data — go to preferences (last step)
  return "/onboarding/preferences";
}
