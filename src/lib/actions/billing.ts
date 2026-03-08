"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface SubscriptionData {
  plan: string;
  status: string;
  applications_used: number;
  applications_limit: number;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Get the current user's subscription details.
 */
export async function getSubscription(): Promise<{
  data?: SubscriptionData;
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
    .from("subscriptions")
    .select(
      "plan, status, applications_used, applications_limit, current_period_end, stripe_customer_id, stripe_subscription_id"
    )
    .eq("profile_id", user.id)
    .single();

  if (error) {
    return { error: "Failed to fetch subscription" };
  }

  return { data: data as SubscriptionData };
}

/**
 * Create a Stripe Checkout session for upgrading to a paid plan.
 */
export async function createCheckoutSession(priceId: string): Promise<{
  url?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!priceId) {
    return { error: "Price ID is required" };
  }

  // Get or create Stripe customer
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("profile_id", user.id)
    .single();

  if (subError) {
    return { error: "Failed to fetch subscription" };
  }

  let customerId = subscription.stripe_customer_id;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      // Store the customer ID
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("profile_id", user.id);

      if (updateError) {
        console.error("Failed to store Stripe customer ID:", updateError.message);
        return { error: "Failed to link billing account" };
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/settings/subscription?success=true`,
      cancel_url: `${APP_URL}/settings/subscription?cancelled=true`,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
    });

    return { url: session.url ?? undefined };
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return { error: "Failed to create checkout session" };
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription.
 */
export async function createPortalSession(): Promise<{
  url?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("profile_id", user.id)
    .single();

  if (subError || !subscription?.stripe_customer_id) {
    return { error: "No active billing account found" };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${APP_URL}/settings/subscription`,
    });

    return { url: session.url };
  } catch (error) {
    console.error("Stripe portal error:", error);
    return { error: "Failed to open billing portal" };
  }
}
