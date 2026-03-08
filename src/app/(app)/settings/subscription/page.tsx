"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  type SubscriptionData,
} from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CreditCard,
  Zap,
  Crown,
  Check,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Pricing configuration                                               */
/* ------------------------------------------------------------------ */

const PRICE_IDS = {
  pro_monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
  pro_annual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID ?? "",
  premium_monthly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? "",
  premium_annual: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID ?? "",
};

interface PricingTier {
  name: string;
  plan: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyPriceId: string;
  annualPriceId: string;
  limit: number;
  icon: React.ReactNode;
  features: { label: string; included: boolean }[];
  highlight?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: "Free",
    plan: "free",
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceId: "",
    annualPriceId: "",
    limit: 5,
    icon: <Zap className="h-5 w-5" />,
    features: [
      { label: "5 applications per month", included: true },
      { label: "Job discovery every 12 hours", included: true },
      { label: "Aggregator API sources", included: true },
      { label: "Manual job input", included: true },
      { label: "Resume tailoring", included: true },
      { label: "PDF resume format", included: true },
      { label: "Basic application answers (3 fields)", included: true },
      { label: "Basic application tracker", included: true },
      { label: "Weekly email digest", included: true },
      { label: "Cover letter generation", included: false },
      { label: "Email forwarding", included: false },
      { label: "Analytics", included: false },
      { label: "Priority support", included: false },
      { label: "Auto-submit (coming soon)", included: false },
    ],
  },
  {
    name: "Pro",
    plan: "pro",
    monthlyPrice: 19,
    annualPrice: 190,
    monthlyPriceId: PRICE_IDS.pro_monthly,
    annualPriceId: PRICE_IDS.pro_annual,
    limit: 50,
    icon: <Zap className="h-5 w-5" />,
    highlight: true,
    features: [
      { label: "50 applications per month", included: true },
      { label: "Job discovery every 6 hours", included: true },
      { label: "All sources", included: true },
      { label: "Manual job input", included: true },
      { label: "Resume tailoring", included: true },
      { label: "PDF + DOCX formats", included: true },
      { label: "Full application answers", included: true },
      { label: "Full tracker with timeline & notes", included: true },
      { label: "Daily or weekly digest", included: true },
      { label: "Cover letter generation", included: true },
      { label: "Email forwarding", included: true },
      { label: "Basic analytics", included: true },
      { label: "Priority support", included: false },
      { label: "Auto-submit (coming soon)", included: false },
    ],
  },
  {
    name: "Premium",
    plan: "premium",
    monthlyPrice: 39,
    annualPrice: 390,
    monthlyPriceId: PRICE_IDS.premium_monthly,
    annualPriceId: PRICE_IDS.premium_annual,
    limit: 200,
    icon: <Crown className="h-5 w-5" />,
    features: [
      { label: "200 applications per month", included: true },
      { label: "Job discovery every 1 hour", included: true },
      { label: "All sources", included: true },
      { label: "Manual job input", included: true },
      { label: "Resume tailoring", included: true },
      { label: "PDF + DOCX formats", included: true },
      { label: "Full application answers", included: true },
      { label: "Full tracker with timeline & notes", included: true },
      { label: "Daily or weekly digest", included: true },
      { label: "Cover letter generation", included: true },
      { label: "Email forwarding", included: true },
      { label: "Full analytics with trends", included: true },
      { label: "Priority support", included: true },
      { label: "Auto-submit (coming soon)", included: true },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Status badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:
      "bg-[var(--w-success-bg)] text-[var(--w-success)] border-[var(--w-success)]/20",
    trialing:
      "bg-[var(--w-success-bg)] text-[var(--w-success)] border-[var(--w-success)]/20",
    past_due:
      "bg-[var(--w-warning-bg)] text-[var(--w-warning)] border-[var(--w-warning)]/20",
    cancelled:
      "bg-[var(--w-error-bg)] text-[var(--w-error)] border-[var(--w-error)]/20",
  };

  const labels: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past Due",
    cancelled: "Cancelled",
  };

  return (
    <Badge
      variant="outline"
      className={colors[status] ?? "bg-[var(--w-surface-alt)] text-[var(--w-text-secondary)]"}
    >
      {labels[status] ?? status}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Usage bar                                                           */
/* ------------------------------------------------------------------ */

function UsageBar({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = percentage >= 80;
  const isFull = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--w-text-secondary)]">
          Applications this period
        </span>
        <span
          className={`font-semibold ${
            isFull
              ? "text-[var(--w-error)]"
              : isHigh
                ? "text-[var(--w-warning)]"
                : "text-[var(--w-text-primary)]"
          }`}
        >
          {used} / {limit}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-[var(--w-surface-alt)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFull
              ? "bg-[var(--w-error)]"
              : isHigh
                ? "bg-[var(--w-warning)]"
                : "bg-[var(--w-primary)]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                            */
/* ------------------------------------------------------------------ */

function SubscriptionSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
        <div className="h-6 w-32 bg-[var(--w-surface-alt)] rounded" />
        <div className="mt-4 h-4 w-48 bg-[var(--w-surface-alt)] rounded" />
        <div className="mt-6 h-2.5 w-full bg-[var(--w-surface-alt)] rounded-full" />
        <div className="mt-4 h-4 w-36 bg-[var(--w-surface-alt)] rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-6 h-96"
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                           */
/* ------------------------------------------------------------------ */

export default function SettingsSubscriptionPage() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">(
    "monthly"
  );
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated successfully!");
    } else if (searchParams.get("cancelled") === "true") {
      toast.info("Checkout cancelled. No changes were made.");
    }
  }, [searchParams]);

  useEffect(() => {
    getSubscription().then((result) => {
      if (result.data) {
        setSubscription(result.data);
      } else if (result.error) {
        toast.error(result.error);
      }
      setLoading(false);
    });
  }, []);

  async function handleUpgrade(priceId: string, planName: string) {
    if (!priceId) {
      toast.error("Pricing not configured yet. Please try again later.");
      return;
    }
    setUpgrading(planName);
    const result = await createCheckoutSession(priceId);
    if (result.url) {
      window.location.href = result.url;
    } else {
      toast.error(result.error ?? "Failed to start checkout");
      setUpgrading(null);
    }
  }

  async function handleManageBilling() {
    setOpeningPortal(true);
    const result = await createPortalSession();
    if (result.url) {
      window.location.href = result.url;
    } else {
      toast.error(result.error ?? "Failed to open billing portal");
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Subscription
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Manage your plan and billing information.
        </p>
        <div className="mt-8">
          <SubscriptionSkeleton />
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan ?? "free";
  const currentTier = TIERS.find((t) => t.plan === currentPlan) ?? TIERS[0];
  const isPaid = currentPlan !== "free";
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--w-text-primary)]">
          Subscription
        </h1>
        <p className="mt-1 text-sm text-[var(--w-text-secondary)]">
          Manage your plan and billing information.
        </p>
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--w-primary)]/10 text-[var(--w-primary)]">
              {currentTier.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--w-text-primary)]">
                  {currentTier.name} Plan
                </h2>
                <StatusBadge status={subscription?.status ?? "active"} />
              </div>
              <p className="text-sm text-[var(--w-text-secondary)]">
                {isPaid
                  ? `${currentTier.limit} applications per month`
                  : "5 applications per month"}
              </p>
            </div>
          </div>
          {isPaid && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={openingPortal}
            >
              {openingPortal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Manage Billing
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="mt-6">
          <UsageBar
            used={subscription?.applications_used ?? 0}
            limit={subscription?.applications_limit ?? 5}
          />
        </div>

        {periodEnd && (
          <p className="mt-3 text-xs text-[var(--w-text-muted)]">
            Period resets on{" "}
            {periodEnd.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}

        {subscription?.status === "past_due" && (
          <div className="mt-4 rounded-lg bg-[var(--w-warning-bg)] border border-[var(--w-warning)]/20 p-3">
            <p className="text-sm text-[var(--w-warning)] font-medium">
              Your payment is past due. Please update your payment method to
              keep your subscription active.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-[var(--w-warning)] text-[var(--w-warning)] hover:bg-[var(--w-warning)]/10"
              onClick={handleManageBilling}
              disabled={openingPortal}
            >
              Update Payment Method
            </Button>
          </div>
        )}

        {subscription?.status === "cancelled" && isPaid && (
          <div className="mt-4 rounded-lg bg-[var(--w-error-bg)] border border-[var(--w-error)]/20 p-3">
            <p className="text-sm text-[var(--w-error)] font-medium">
              Your subscription has been cancelled.{" "}
              {periodEnd && periodEnd > new Date()
                ? `You'll retain access until ${periodEnd.toLocaleDateString()}.`
                : "You've been moved to the Free plan."}
            </p>
          </div>
        )}
      </div>

      {/* Free user upgrade prompt — more urgent when at limit */}
      {!isPaid && (subscription?.applications_used ?? 0) >= (subscription?.applications_limit ?? 5) ? (
        <div className="rounded-xl border-2 border-[var(--w-warning)] bg-[var(--w-warning-bg)] p-6">
          <h3 className="text-lg font-semibold text-[var(--w-text-primary)]">
            You've reached your free plan limit
          </h3>
          <p className="mt-1 text-sm text-[var(--w-text-secondary)] max-w-xl">
            Woodhouse has prepared applications for you, but they're locked
            until you upgrade. Your work isn't lost — unlock it now by
            upgrading to Pro or Premium.
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              className="bg-[var(--w-primary)] hover:bg-[var(--w-primary-dark)] text-white"
              onClick={() =>
                handleUpgrade(
                  billingInterval === "monthly"
                    ? PRICE_IDS.pro_monthly
                    : PRICE_IDS.pro_annual,
                  "pro"
                )
              }
              disabled={upgrading === "pro"}
            >
              {upgrading === "pro" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upgrade to Pro — ${billingInterval === "monthly" ? "19" : "16"}/mo
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                handleUpgrade(
                  billingInterval === "monthly"
                    ? PRICE_IDS.premium_monthly
                    : PRICE_IDS.premium_annual,
                  "premium"
                )
              }
              disabled={upgrading === "premium"}
            >
              {upgrading === "premium" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upgrade to Premium
            </Button>
          </div>
        </div>
      ) : !isPaid ? (
        <div className="rounded-xl border-2 border-[var(--w-primary)]/20 bg-gradient-to-br from-[var(--w-primary)]/5 to-transparent p-6">
          <h3 className="text-lg font-semibold text-[var(--w-text-primary)]">
            Upgrade to unlock your full potential
          </h3>
          <p className="mt-1 text-sm text-[var(--w-text-secondary)] max-w-xl">
            Get more applications, faster discovery, cover letters, email
            forwarding, and advanced analytics. Let Woodhouse work harder for
            your job search.
          </p>
        </div>
      ) : null}

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBillingInterval("monthly")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            billingInterval === "monthly"
              ? "bg-[var(--w-primary)] text-white"
              : "text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] hover:bg-[var(--w-surface-alt)]"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingInterval("annual")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            billingInterval === "annual"
              ? "bg-[var(--w-primary)] text-white"
              : "text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] hover:bg-[var(--w-surface-alt)]"
          }`}
        >
          Annual
          <span className="ml-1.5 text-xs opacity-80">Save 2 months</span>
        </button>
      </div>

      {/* Pricing tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = tier.plan === currentPlan;
          const isDowngrade =
            (currentPlan === "premium" && tier.plan !== "premium") ||
            (currentPlan === "pro" && tier.plan === "free");
          const price =
            billingInterval === "monthly"
              ? tier.monthlyPrice
              : tier.annualPrice;
          const priceId =
            billingInterval === "monthly"
              ? tier.monthlyPriceId
              : tier.annualPriceId;

          return (
            <div
              key={tier.plan}
              className={`relative rounded-xl border bg-[var(--w-surface)] p-6 flex flex-col ${
                tier.highlight && !isCurrent
                  ? "border-[var(--w-primary)] shadow-md"
                  : isCurrent
                    ? "border-[var(--w-success)] shadow-md"
                    : "border-[var(--w-border)]"
              }`}
            >
              {tier.highlight && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[var(--w-primary)] text-white border-0 px-3">
                    Most Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[var(--w-success)] text-white border-0 px-3">
                    Current Plan
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 text-[var(--w-text-primary)]">
                {tier.icon}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
              </div>

              <div className="mt-4">
                {price === 0 ? (
                  <p className="text-3xl font-bold text-[var(--w-text-primary)]">
                    Free
                  </p>
                ) : (
                  <div>
                    <p className="text-3xl font-bold text-[var(--w-text-primary)]">
                      ${billingInterval === "monthly" ? price : Math.round(price / 12)}
                      <span className="text-base font-normal text-[var(--w-text-secondary)]">
                        /mo
                      </span>
                    </p>
                    {billingInterval === "annual" && (
                      <p className="text-xs text-[var(--w-text-muted)] mt-1">
                        ${price}/year — billed annually
                      </p>
                    )}
                  </div>
                )}
              </div>

              <p className="mt-2 text-sm text-[var(--w-text-secondary)]">
                {tier.limit} applications/month
              </p>

              <ul className="mt-6 space-y-2.5 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature.label}
                    className="flex items-start gap-2 text-sm"
                  >
                    {feature.included ? (
                      <Check className="h-4 w-4 mt-0.5 text-[var(--w-success)] shrink-0" />
                    ) : (
                      <X className="h-4 w-4 mt-0.5 text-[var(--w-text-muted)] shrink-0" />
                    )}
                    <span
                      className={
                        feature.included
                          ? "text-[var(--w-text-primary)]"
                          : "text-[var(--w-text-muted)]"
                      }
                    >
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : tier.plan === "free" ? (
                  isDowngrade && isPaid ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManageBilling}
                      disabled={openingPortal}
                    >
                      Downgrade via Billing Portal
                    </Button>
                  ) : null
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleManageBilling}
                    disabled={openingPortal}
                  >
                    Manage via Billing Portal
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      tier.highlight
                        ? "bg-[var(--w-primary)] hover:bg-[var(--w-primary-dark)] text-white"
                        : ""
                    }`}
                    onClick={() => handleUpgrade(priceId, tier.plan)}
                    disabled={upgrading === tier.plan}
                  >
                    {upgrading === tier.plan ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Upgrade to {tier.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ / notes */}
      <div className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-6">
        <h3 className="text-sm font-semibold text-[var(--w-text-primary)]">
          Billing FAQ
        </h3>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-[var(--w-text-primary)]">
              Can I cancel anytime?
            </dt>
            <dd className="mt-1 text-[var(--w-text-secondary)]">
              Yes. Cancellations take effect at the end of your current billing
              period. You keep access to all paid features until then.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--w-text-primary)]">
              What happens when I hit my application limit?
            </dt>
            <dd className="mt-1 text-[var(--w-text-secondary)]">
              Woodhouse continues preparing applications for you, but they'll be
              locked behind an upgrade prompt. Your work is never lost — just
              upgrade to unlock.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--w-text-primary)]">
              Do I need a credit card for the free plan?
            </dt>
            <dd className="mt-1 text-[var(--w-text-secondary)]">
              No. The free plan is completely free with no credit card required.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
