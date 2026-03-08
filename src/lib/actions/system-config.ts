"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TailoringPromptMode =
  | "system_default"
  | "admin_custom"
  | "user_choice";

const VALID_MODES: TailoringPromptMode[] = [
  "system_default",
  "admin_custom",
  "user_choice",
];

export interface TailoringConfig {
  mode: TailoringPromptMode;
  adminText: string | null;
  userInstructionsEnabled: boolean;
}

/* ------------------------------------------------------------------ */
/*  Admin Check                                                        */
/* ------------------------------------------------------------------ */

async function isAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) return false;
  const list = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

/* ------------------------------------------------------------------ */
/*  Read Config (any authenticated user)                               */
/* ------------------------------------------------------------------ */

export async function getSystemConfig(
  key: string
): Promise<{ data?: string | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    return { error: `Failed to read config: ${error.message}` };
  }

  return { data: data?.value ?? null };
}

/* ------------------------------------------------------------------ */
/*  Write Config (admin only)                                          */
/* ------------------------------------------------------------------ */

export async function setSystemConfig(
  key: string,
  value: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!(await isAdmin(user.email))) {
    return { error: "Forbidden: admin access required" };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("system_config")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    return { error: `Failed to write config: ${error.message}` };
  }

  revalidatePath("/admin");
  return {};
}

/* ------------------------------------------------------------------ */
/*  Tailoring Config (combined read)                                   */
/* ------------------------------------------------------------------ */

export async function getTailoringConfig(): Promise<{
  data?: TailoringConfig;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("system_config")
    .select("key, value")
    .in("key", ["tailoring_prompt_mode", "tailoring_prompt_admin_text"]);

  if (error) {
    return { error: `Failed to read tailoring config: ${error.message}` };
  }

  const configMap = Object.fromEntries(
    (data ?? []).map((d) => [d.key, d.value])
  );

  const mode = (configMap["tailoring_prompt_mode"] ??
    "system_default") as TailoringPromptMode;

  return {
    data: {
      mode,
      adminText: configMap["tailoring_prompt_admin_text"] ?? null,
      userInstructionsEnabled: mode === "user_choice",
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Set Tailoring Mode + Admin Text (admin only)                       */
/* ------------------------------------------------------------------ */

export async function setTailoringConfig(
  mode: TailoringPromptMode,
  adminText: string | null
): Promise<{ error?: string }> {
  if (!VALID_MODES.includes(mode)) {
    return { error: `Invalid mode: ${mode}` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!(await isAdmin(user.email))) {
    return { error: "Forbidden: admin access required" };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: modeError } = await admin
    .from("system_config")
    .upsert(
      { key: "tailoring_prompt_mode", value: mode, updated_at: now },
      { onConflict: "key" }
    );

  if (modeError) {
    return { error: `Failed to set mode: ${modeError.message}` };
  }

  const { error: textError } = await admin
    .from("system_config")
    .upsert(
      {
        key: "tailoring_prompt_admin_text",
        value: adminText || null,
        updated_at: now,
      },
      { onConflict: "key" }
    );

  if (textError) {
    return { error: `Failed to set admin text: ${textError.message}` };
  }

  revalidatePath("/admin");
  return {};
}

/* ------------------------------------------------------------------ */
/*  User Tailoring Instructions                                        */
/* ------------------------------------------------------------------ */

export async function getTailoringInstructions(): Promise<{
  data?: string | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("search_preferences")
    .select("tailoring_instructions")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) {
    return { error: `Failed to read tailoring instructions: ${error.message}` };
  }

  return { data: data?.tailoring_instructions ?? null };
}

export async function setTailoringInstructions(
  instructions: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("search_preferences")
    .update({
      tailoring_instructions: instructions || null,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to save tailoring instructions: ${error.message}` };
  }

  revalidatePath("/settings");
  return {};
}

/* ------------------------------------------------------------------ */
/*  Admin Check Utility (for UI gating)                                */
/* ------------------------------------------------------------------ */

export async function checkIsAdmin(): Promise<{
  data?: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  return { data: await isAdmin(user.email) };
}
