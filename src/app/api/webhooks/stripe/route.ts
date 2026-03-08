import { NextRequest, NextResponse } from "next/server";
import { stripe, planFromPriceId, PLAN_LIMITS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

/* ------------------------------------------------------------------ */
/*  Stripe Webhook Handler                                              */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice);
        break;

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook handler error (${event.type}):`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Extract period dates from the first subscription item. */
function getPeriodDates(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  if (!item) return { start: null, end: null };
  return {
    start: new Date(item.current_period_start * 1000).toISOString(),
    end: new Date(item.current_period_end * 1000).toISOString(),
  };
}

/** Extract subscription ID from an Invoice (Stripe v20 moved it to parent). */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/* ------------------------------------------------------------------ */
/*  Event Handlers                                                      */
/* ------------------------------------------------------------------ */

/**
 * checkout.session.completed
 * A customer completed a Checkout session — create or update their subscription.
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.user_id;
  if (!userId) {
    throw new Error("checkout.session.completed: no user_id in metadata");
  }

  const subscriptionId = session.subscription as string | null;
  const customerId = session.customer as string | null;

  if (!subscriptionId) {
    throw new Error("checkout.session.completed: no subscription ID");
  }

  // Retrieve the full subscription to get price details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const plan = planFromPriceId(priceId);
  const limit = PLAN_LIMITS[plan] ?? 5;
  const period = getPeriodDates(subscription);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan,
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_start: period.start,
      current_period_end: period.end,
      applications_limit: limit,
    })
    .eq("profile_id", userId);

  if (error) {
    console.error("Failed to update subscription on checkout:", error.message);
    throw error;
  }

  // Create a notification for the user
  await supabase.rpc("create_notification", {
    p_profile_id: userId,
    p_type: "system",
    p_title: "Subscription activated",
    p_body: `Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan is now active. You have ${limit} applications per month.`,
    p_metadata: { plan, limit },
  });
}

/**
 * customer.subscription.updated
 * Subscription changed — update plan, status, period dates, and limits.
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const plan = planFromPriceId(priceId);
  const limit = PLAN_LIMITS[plan] ?? 5;
  const period = getPeriodDates(subscription);

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "cancelled",
    trialing: "trialing",
    unpaid: "past_due",
    incomplete: "past_due",
    incomplete_expired: "cancelled",
    paused: "cancelled",
  };

  const mappedStatus = statusMap[subscription.status] ?? "active";

  // Check if the billing period rolled over — reset usage counter
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("current_period_start")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const periodChanged =
    existing && period.start && existing.current_period_start !== period.start;

  const updatePayload: Record<string, unknown> = {
    plan,
    status: mappedStatus,
    current_period_start: period.start,
    current_period_end: period.end,
    applications_limit: limit,
  };

  if (periodChanged) {
    updatePayload.applications_used = 0;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to update subscription:", error.message);
    throw error;
  }
}

/**
 * customer.subscription.deleted
 * Subscription cancelled — revert to free plan.
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan: "free",
      status: "cancelled",
      applications_limit: PLAN_LIMITS.free,
      current_period_start: null,
      current_period_end: null,
      stripe_subscription_id: null,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to handle subscription deletion:", error.message);
    throw error;
  }

  // Notify user
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("profile_id")
    .eq("stripe_customer_id", subscription.customer as string)
    .maybeSingle();

  if (sub) {
    await supabase.rpc("create_notification", {
      p_profile_id: sub.profile_id,
      p_type: "subscription_warning",
      p_title: "Subscription cancelled",
      p_body: "Your subscription has been cancelled. You've been moved to the Free plan with 5 applications per month.",
      p_metadata: { previous_plan: planFromPriceId(subscription.items.data[0]?.price?.id ?? "") },
    });
  }
}

/**
 * invoice.payment_failed
 * Payment failed — set status to past_due.
 */
async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Failed to update subscription on payment failure:", error.message);
    throw error;
  }

  // Notify user
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("profile_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (sub) {
    await supabase.rpc("create_notification", {
      p_profile_id: sub.profile_id,
      p_type: "subscription_warning",
      p_title: "Payment failed",
      p_body: "Your latest payment failed. Please update your payment method to keep your subscription active.",
      p_metadata: { invoice_id: invoice.id },
    });
  }
}
