"use server";

import { createClient } from "@/lib/supabase/server";
import { checkSubscription } from "@/lib/subscription";
import { randomBytes } from "crypto";

const INBOUND_DOMAIN = "inbound.woodhouse.app";

/**
 * Get the user's forwarding address. If none exists, generate one.
 * Email forwarding is Pro/Premium only.
 */
export async function getForwardingAddress(): Promise<{
  data?: string;
  error?: string;
  gated?: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check subscription — email forwarding is Pro/Premium only
  const sub = await checkSubscription(user.id);
  if (sub.data && !sub.data.email_forwarding_enabled) {
    return {
      error: "Email forwarding is available on Pro and Premium plans.",
      gated: true,
    };
  }

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("forwarding_address")
    .eq("id", user.id)
    .single();

  if (fetchError) {
    return { error: `Failed to fetch profile: ${fetchError.message}` };
  }

  if (profile.forwarding_address) {
    return { data: profile.forwarding_address };
  }

  // Generate a unique forwarding address
  const shortId = randomBytes(4).toString("hex"); // 8-char hex
  const address = `jobs+${shortId}@${INBOUND_DOMAIN}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ forwarding_address: address })
    .eq("id", user.id);

  if (updateError) {
    // If UNIQUE violation, try again with a new ID
    if (updateError.message.includes("unique") || updateError.message.includes("duplicate")) {
      const retryId = randomBytes(4).toString("hex");
      const retryAddress = `jobs+${retryId}@${INBOUND_DOMAIN}`;

      const { error: retryError } = await supabase
        .from("profiles")
        .update({ forwarding_address: retryAddress })
        .eq("id", user.id);

      if (retryError) {
        return { error: `Failed to generate forwarding address: ${retryError.message}` };
      }

      return { data: retryAddress };
    }

    return { error: `Failed to save forwarding address: ${updateError.message}` };
  }

  return { data: address };
}
