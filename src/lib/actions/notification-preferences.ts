"use server";

import { createClient } from "@/lib/supabase/server";

export interface NotificationPref {
  notification_type: string;
  in_app: boolean;
  email: boolean;
}

const NOTIFICATION_TYPES = [
  "new_matches",
  "applications_ready",
  "follow_up_reminder",
  "status_stale",
] as const;

const VALID_TYPES = new Set<string>(NOTIFICATION_TYPES);

export async function getNotificationPreferences(): Promise<NotificationPref[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notification_preferences")
    .select("notification_type, in_app, email")
    .eq("profile_id", user.id);

  // Return existing prefs merged with defaults for any missing types
  const existing = new Map(
    (data ?? []).map((p) => [p.notification_type, p])
  );

  return NOTIFICATION_TYPES.map((type) => ({
    notification_type: type,
    in_app: existing.get(type)?.in_app ?? true,
    email: existing.get(type)?.email ?? true,
  }));
}

export async function updateNotificationPreference(
  notificationType: string,
  channel: "in_app" | "email",
  enabled: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!VALID_TYPES.has(notificationType)) {
    return { error: "Invalid notification type" };
  }

  // Try targeted update first (for existing rows)
  const { data: updated, error: updateError } = await supabase
    .from("notification_preferences")
    .update({ [channel]: enabled })
    .eq("profile_id", user.id)
    .eq("notification_type", notificationType)
    .select("id");

  if (updateError) return { error: updateError.message };

  // If no row existed, insert with defaults
  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from("notification_preferences")
      .insert({
        profile_id: user.id,
        notification_type: notificationType,
        in_app: channel === "in_app" ? enabled : true,
        email: channel === "email" ? enabled : true,
      });

    if (insertError) return { error: insertError.message };
  }

  return { success: true };
}
