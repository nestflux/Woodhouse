"use server";

import { createClient } from "@/lib/supabase/server";

export interface SubscriptionFeatures {
  plan: "free" | "pro" | "premium";
  status: string;
  applications_used: number;
  applications_limit: number;
  can_approve: boolean;
  cover_letter_enabled: boolean;
  full_application_answers: boolean;
  email_forwarding_enabled: boolean;
  full_tracker: boolean;
  docx_export: boolean;
  full_analytics: boolean;
  resume_builder_limit: number;
  resume_builder_docx_export: boolean;
}

/**
 * Central subscription check — returns plan details and enabled features.
 * Call this from server actions and pass feature flags to client components.
 */
export async function checkSubscription(
  profileId?: string
): Promise<{ data?: SubscriptionFeatures; error?: string }> {
  const supabase = await createClient();

  let userId = profileId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };
    userId = user.id;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, applications_used, applications_limit")
    .eq("profile_id", userId)
    .single();

  if (error) {
    return { error: `Failed to check subscription: ${error.message}` };
  }

  const plan = (data.plan ?? "free") as "free" | "pro" | "premium";
  const isPaid = plan !== "free";

  return {
    data: {
      plan,
      status: data.status ?? "active",
      applications_used: data.applications_used ?? 0,
      applications_limit: data.applications_limit ?? 5,
      can_approve: data.applications_used < data.applications_limit,
      cover_letter_enabled: isPaid,
      full_application_answers: isPaid,
      email_forwarding_enabled: isPaid,
      full_tracker: isPaid,
      docx_export: isPaid,
      full_analytics: isPaid,
      resume_builder_limit: plan === "premium" ? 10 : plan === "pro" ? 5 : 3,
      resume_builder_docx_export: isPaid,
    },
  };
}
