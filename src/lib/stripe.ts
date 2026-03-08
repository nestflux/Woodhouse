import "server-only";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/**
 * Plan limits — must stay in sync with DB defaults and handle_new_user().
 * free=5, pro=50, premium=200
 */
export const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 50,
  premium: 200,
};

/**
 * Map Stripe Price IDs to internal plan names.
 * These must match the prices created in the Stripe Dashboard.
 * Only entries with configured env vars are included.
 */
export const PRICE_TO_PLAN: Record<string, string> = Object.fromEntries(
  [
    [process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID, "pro"],
    [process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID, "pro"],
    [process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID, "premium"],
    [process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID, "premium"],
  ].filter((entry): entry is [string, string] => !!entry[0])
);

/**
 * Resolve a plan name from a Stripe Price ID.
 */
export function planFromPriceId(priceId: string): string {
  if (!priceId) return "free";
  return PRICE_TO_PLAN[priceId] ?? "free";
}
