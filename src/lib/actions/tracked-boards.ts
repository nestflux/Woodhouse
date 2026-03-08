"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const VALID_PLATFORMS = ["greenhouse", "lever"] as const;

const GREENHOUSE_URL_PATTERN =
  /^https?:\/\/boards\.greenhouse\.io\/[a-zA-Z0-9._-]+\/?$/;
const LEVER_URL_PATTERN =
  /^https?:\/\/jobs\.lever\.co\/[a-zA-Z0-9._-]+\/?$/;

function isValidBoardUrl(
  platform: string,
  url: string
): { valid: boolean; error?: string } {
  if (platform === "greenhouse") {
    if (!GREENHOUSE_URL_PATTERN.test(url)) {
      return {
        valid: false,
        error:
          "Invalid Greenhouse URL. Expected format: https://boards.greenhouse.io/company",
      };
    }
  } else if (platform === "lever") {
    if (!LEVER_URL_PATTERN.test(url)) {
      return {
        valid: false,
        error:
          "Invalid Lever URL. Expected format: https://jobs.lever.co/company",
      };
    }
  }
  return { valid: true };
}

export async function getTrackedBoards() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tracked_boards")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function createTrackedBoard(data: {
  platform: string;
  board_url: string;
  company_name: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (
    !VALID_PLATFORMS.includes(data.platform as (typeof VALID_PLATFORMS)[number])
  ) {
    return { error: "Platform must be 'greenhouse' or 'lever'" };
  }

  if (!data.board_url.trim()) {
    return { error: "Board URL is required" };
  }

  if (!data.company_name.trim()) {
    return { error: "Company name is required" };
  }

  const normalizedUrl = data.board_url.trim().replace(/\/+$/, "");

  const urlValidation = isValidBoardUrl(data.platform, normalizedUrl);
  if (!urlValidation.valid) {
    return { error: urlValidation.error };
  }

  const { data: result, error } = await supabase
    .from("tracked_boards")
    .insert({
      profile_id: user.id,
      platform: data.platform,
      board_url: normalizedUrl,
      company_name: data.company_name.trim(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "You are already tracking this board URL" };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { success: true, data: result };
}

export async function deleteTrackedBoard(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("tracked_boards")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
