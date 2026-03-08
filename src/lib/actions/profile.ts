"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBasicInfo(data: {
  full_name: string;
  phone?: string;
  country?: string;
  location?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  github_url?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.full_name.trim()) {
    return { error: "Full name is required" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.full_name.trim(),
      phone: data.phone?.trim() || null,
      country: data.country?.trim() || null,
      location: data.location?.trim() || null,
      linkedin_url: data.linkedin_url?.trim() || null,
      portfolio_url: data.portfolio_url?.trim() || null,
      github_url: data.github_url?.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  revalidatePath("/settings/profile");
  return { success: true };
}

export async function updateHeadline(data: {
  headline?: string;
  summary?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      headline: data.headline?.trim() || null,
      summary: data.summary?.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  revalidatePath("/settings/profile");
  return { success: true };
}

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

export async function updateEmailDigest(value: "none" | "daily" | "weekly") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ email_digest: value })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings/preferences");
  return { success: true };
}
