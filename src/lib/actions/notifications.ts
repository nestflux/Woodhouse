"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const PAGE_SIZE = 20;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface NotificationsResult {
  data: Notification[];
  total: number;
  hasMore: boolean;
}

/* ------------------------------------------------------------------ */
/*  Get Notifications (paginated, filterable)                          */
/* ------------------------------------------------------------------ */

export async function getNotifications(
  page = 1,
  readFilter?: boolean
): Promise<{ data?: NotificationsResult; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const offset = (page - 1) * PAGE_SIZE;

  // Build query for count
  let countQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if (readFilter !== undefined) {
    countQuery = countQuery.eq("read", readFilter);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    return { error: `Failed to count notifications: ${countError.message}` };
  }

  // Build query for data
  let dataQuery = supabase
    .from("notifications")
    .select("id, type, title, body, metadata, read, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (readFilter !== undefined) {
    dataQuery = dataQuery.eq("read", readFilter);
  }

  const { data, error } = await dataQuery;

  if (error) {
    return { error: `Failed to fetch notifications: ${error.message}` };
  }

  return {
    data: {
      data: (data ?? []) as Notification[],
      total: count ?? 0,
      hasMore: offset + PAGE_SIZE < (count ?? 0),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Get Unread Count                                                   */
/* ------------------------------------------------------------------ */

export async function getUnreadCount(): Promise<{
  data?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("read", false);

  if (error) {
    return { error: `Failed to count notifications: ${error.message}` };
  }

  return { data: count ?? 0 };
}

/* ------------------------------------------------------------------ */
/*  Mark Notification Read                                             */
/* ------------------------------------------------------------------ */

export async function markNotificationRead(
  notificationId: string
): Promise<{ error?: string }> {
  if (!UUID_REGEX.test(notificationId)) {
    return { error: "Invalid notification ID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("profile_id", user.id);

  if (error) {
    return { error: `Failed to mark notification as read: ${error.message}` };
  }

  revalidatePath("/notifications");
  return {};
}

/* ------------------------------------------------------------------ */
/*  Mark All Read                                                      */
/* ------------------------------------------------------------------ */

export async function markAllNotificationsRead(): Promise<{
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("profile_id", user.id)
    .eq("read", false);

  if (error) {
    return { error: `Failed to mark all as read: ${error.message}` };
  }

  revalidatePath("/notifications");
  return {};
}
