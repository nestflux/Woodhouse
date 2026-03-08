import Link from "next/link";
import {
  Search,
  Target,
  FileText,
  PenTool,
  ClipboardCheck,
  BarChart3,
  UserPlus,
  Radar,
  CheckCircle2,
  Check,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

const HOW_IT_WORKS = [
  {
    step: 1,
    icon: UserPlus,
    title: "Set up your profile",
    description:
      "Upload your resume or enter your experience, skills, and preferences. Woodhouse learns what makes you a great candidate.",
  },
  {
    step: 2,
    icon: Radar,
    title: "Woodhouse scans and matches",
    description:
      "Your AI agent searches job boards, evaluates fit, tailors your resume, and prepares application materials — automatically.",
  },
  {
    step: 3,
    icon: CheckCircle2,
    title: "Review and apply",
    description:
      "Review prepared applications, make any edits, then approve. Woodhouse opens the application link and copies your materials.",
  },
];

const FEATURES = [
  {
    icon: Search,
    title: "Automated Discovery",
    description:
      "Woodhouse continuously scans aggregator APIs and company career pages, finding relevant roles before you even know they exist.",
  },
  {
    icon: Target,
    title: "Smart Matching",
    description:
      "Each job is evaluated against your profile across five dimensions — skills, experience, education, values, and logistics — for a precise match score.",
  },
  {
    icon: FileText,
    title: "Resume Tailoring",
    description:
      "Your resume is intelligently rewritten for each role, emphasizing relevant achievements and skills while staying truthful to your experience.",
  },
  {
    icon: PenTool,
    title: "Material Generation",
    description:
      "Cover letters, application answers, and follow-up templates are crafted specifically for each job, using only facts from your profile.",
  },
  {
    icon: ClipboardCheck,
    title: "Review Queue",
    description:
      "Every application is prepared for your review. You stay in control — nothing is submitted without your explicit approval.",
  },
  {
    icon: BarChart3,
    title: "Application Tracking",
    description:
      "Track every application through its lifecycle with a visual pipeline. Add notes, set reminders, and monitor response rates.",
  },
];

interface TierFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  premium: string | boolean;
}

const PRICING_FEATURES: TierFeature[] = [
  { label: "Applications per month", free: "5", pro: "50", premium: "200" },
  { label: "Job discovery frequency", free: "Every 12h", pro: "Every 6h", premium: "Every 1h" },
  { label: "Sources", free: "Aggregator APIs", pro: "All sources", premium: "All sources" },
  { label: "Manual job input", free: true, pro: true, premium: true },
  { label: "Resume tailoring", free: true, pro: true, premium: true },
  { label: "Cover letter generation", free: false, pro: true, premium: true },
  { label: "Application answers", free: "Basic (3 fields)", pro: "Full", premium: "Full" },
  { label: "Resume formats", free: "PDF", pro: "PDF + DOCX", premium: "PDF + DOCX" },
  { label: "Application tracker", free: "Basic (status only)", pro: "Full (timeline, notes, reminders)", premium: "Full (timeline, notes, reminders)" },
  { label: "Email forwarding", free: false, pro: true, premium: true },
  { label: "Email digest", free: "Weekly", pro: "Daily/Weekly", premium: "Daily/Weekly" },
  { label: "Analytics", free: "None", pro: "Basic (response rate)", premium: "Full (trends, insights)" },
  { label: "Priority support", free: false, pro: false, premium: true },
  { label: "Auto-submit (Phase 2)", free: false, pro: false, premium: true },
];

/* ------------------------------------------------------------------ */
/*  Components                                                          */
/* ------------------------------------------------------------------ */

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true)
    return (
      <span className="flex items-center justify-center">
        <Check className="h-4 w-4 text-[var(--w-success)]" />
        <span className="sr-only">Included</span>
      </span>
    );
  if (value === false)
    return (
      <span className="flex items-center justify-center">
        <X className="h-4 w-4 text-[var(--w-text-muted)]" />
        <span className="sr-only">Not included</span>
      </span>
    );
  return <span>{value}</span>;
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--w-background)]">
      {/* ============================================================ */}
      {/*  Sticky Nav                                                   */}
      {/* ============================================================ */}
      <nav className="sticky top-0 z-50 border-b border-[var(--w-border)] bg-[var(--w-surface)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-xl font-bold text-[var(--w-primary)]">
            Woodhouse
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="text-sm font-medium text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--w-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--w-accent-light)] transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  Hero                                                         */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--w-primary)] to-[var(--w-primary-dark)] px-6 py-24 sm:py-32 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(217,119,6,.08)_0%,transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Your AI Recruiting Agent.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/70 leading-relaxed max-w-2xl mx-auto">
            Woodhouse finds jobs, tailors your resume, and prepares applications
            — while you focus on what matters.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--w-accent)] px-8 py-3.5 text-base font-bold text-white shadow-lg hover:bg-[var(--w-accent-light)] transition-colors"
            >
              Get Started Free
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/40">
            No credit card required. 5 free applications every month.
          </p>

          {/* Product mockup */}
          <div className="mt-14 mx-auto max-w-2xl">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10">
                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <div className="ml-4 h-4 w-40 rounded bg-white/10" />
              </div>
              <div className="p-5 space-y-3">
                <div className="flex gap-4">
                  <div className="w-48 space-y-2">
                    <div className="h-3 w-20 rounded bg-white/15" />
                    <div className="h-7 w-full rounded bg-white/8" />
                    <div className="h-7 w-full rounded bg-[var(--w-accent)]/30" />
                    <div className="h-7 w-full rounded bg-white/8" />
                    <div className="h-7 w-full rounded bg-white/8" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg bg-white/8 p-3 space-y-1.5">
                        <div className="h-2 w-12 rounded bg-white/20" />
                        <div className="h-5 w-6 rounded bg-[var(--w-success)]/50" />
                      </div>
                      <div className="flex-1 rounded-lg bg-white/8 p-3 space-y-1.5">
                        <div className="h-2 w-16 rounded bg-white/20" />
                        <div className="h-5 w-10 rounded bg-[var(--w-accent)]/40" />
                      </div>
                      <div className="flex-1 rounded-lg bg-white/8 p-3 space-y-1.5">
                        <div className="h-2 w-14 rounded bg-white/20" />
                        <div className="h-5 w-8 rounded bg-white/15" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/8 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded bg-white/15" />
                          <div className="space-y-1">
                            <div className="h-2.5 w-28 rounded bg-white/20" />
                            <div className="h-2 w-20 rounded bg-white/10" />
                          </div>
                        </div>
                        <div className="h-5 w-10 rounded-full bg-[var(--w-success)]/40 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white/60">92</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/8 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded bg-white/15" />
                          <div className="space-y-1">
                            <div className="h-2.5 w-32 rounded bg-white/20" />
                            <div className="h-2 w-24 rounded bg-white/10" />
                          </div>
                        </div>
                        <div className="h-5 w-10 rounded-full bg-[var(--w-success)]/40 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white/60">85</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  How It Works                                                 */}
      {/* ============================================================ */}
      <section className="px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-[var(--w-text-primary)] tracking-tight">
            How It Works
          </h2>
          <p className="mt-3 text-center text-[var(--w-text-secondary)] max-w-xl mx-auto">
            Three steps from profile to prepared applications.
          </p>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--w-primary)]/10">
                  <item.icon className="h-7 w-7 text-[var(--w-primary)]" />
                </div>
                <div className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--w-accent)] text-xs font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[var(--w-text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--w-text-secondary)] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Features Grid                                                */}
      {/* ============================================================ */}
      <section className="bg-[var(--w-surface-alt)] px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-[var(--w-text-primary)] tracking-tight">
            Everything You Need
          </h2>
          <p className="mt-3 text-center text-[var(--w-text-secondary)] max-w-xl mx-auto">
            From discovery to application, Woodhouse handles the entire pipeline.
          </p>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] p-6 shadow-[var(--w-shadow-sm)] transition-shadow hover:shadow-[var(--w-shadow-md)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--w-primary)]/10">
                  <feature.icon className="h-5 w-5 text-[var(--w-primary)]" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--w-text-primary)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--w-text-secondary)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Pricing                                                      */}
      {/* ============================================================ */}
      <section className="px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-[var(--w-text-primary)] tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-center text-[var(--w-text-secondary)] max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>

          {/* Pricing Cards (mobile) / Table (desktop) */}
          {/* Mobile: stacked cards */}
          <div className="mt-14 grid grid-cols-1 gap-6 sm:hidden">
            {/* Free */}
            <PricingCard
              name="Free"
              price="$0"
              period=""
              description="Get started with the basics"
              cta="Get Started Free"
              ctaHref="/signup"
              accent={false}
            />
            {/* Pro */}
            <PricingCard
              name="Pro"
              price="$19"
              period="/mo"
              description="For active job seekers"
              cta="Get Started"
              ctaHref="/signup"
              accent={true}
            />
            {/* Premium */}
            <PricingCard
              name="Premium"
              price="$39"
              period="/mo"
              description="Maximum speed and volume"
              cta="Get Started"
              ctaHref="/signup"
              accent={false}
            />
          </div>

          {/* Desktop: comparison table */}
          <div className="mt-14 hidden sm:block rounded-xl border border-[var(--w-border)] bg-[var(--w-surface)] overflow-hidden shadow-[var(--w-shadow-sm)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--w-border)]">
                  <th scope="col" className="px-6 py-5 text-left text-sm font-medium text-[var(--w-text-muted)]">
                    Feature
                  </th>
                  <th scope="col" className="px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-[var(--w-text-primary)]">Free</div>
                    <div className="text-2xl font-bold text-[var(--w-text-primary)] mt-1">$0</div>
                  </th>
                  <th scope="col" className="px-6 py-5 text-center bg-[var(--w-primary)]/5 relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--w-accent)]" />
                    <div className="text-sm font-semibold text-[var(--w-primary)]">Pro</div>
                    <div className="text-2xl font-bold text-[var(--w-primary)] mt-1">
                      $19<span className="text-sm font-normal text-[var(--w-text-muted)]">/mo</span>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-[var(--w-text-primary)]">Premium</div>
                    <div className="text-2xl font-bold text-[var(--w-text-primary)] mt-1">
                      $39<span className="text-sm font-normal text-[var(--w-text-muted)]">/mo</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--w-border)]">
                {PRICING_FEATURES.map((feat) => (
                  <tr key={feat.label} className="text-sm">
                    <td className="px-6 py-3.5 text-[var(--w-text-secondary)] font-medium">
                      {feat.label}
                    </td>
                    <td className="px-6 py-3.5 text-center text-[var(--w-text-secondary)]">
                      <FeatureCell value={feat.free} />
                    </td>
                    <td className="px-6 py-3.5 text-center text-[var(--w-text-secondary)] bg-[var(--w-primary)]/5">
                      <FeatureCell value={feat.pro} />
                    </td>
                    <td className="px-6 py-3.5 text-center text-[var(--w-text-secondary)]">
                      <FeatureCell value={feat.premium} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--w-border)]">
                  <td className="px-6 py-5" />
                  <td className="px-6 py-5 text-center">
                    <Link
                      href="/signup"
                      className="inline-flex rounded-[var(--radius-md)] border border-[var(--w-border)] px-5 py-2 text-sm font-semibold text-[var(--w-text-primary)] hover:bg-[var(--w-surface-alt)] transition-colors"
                    >
                      Get Started Free
                    </Link>
                  </td>
                  <td className="px-6 py-5 text-center bg-[var(--w-primary)]/5">
                    <Link
                      href="/signup"
                      className="inline-flex rounded-[var(--radius-md)] bg-[var(--w-accent)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--w-accent-light)] transition-colors"
                    >
                      Get Started
                    </Link>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Link
                      href="/signup"
                      className="inline-flex rounded-[var(--radius-md)] border border-[var(--w-primary)] px-5 py-2 text-sm font-semibold text-[var(--w-primary)] hover:bg-[var(--w-primary)]/5 transition-colors"
                    >
                      Get Started
                    </Link>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA                                                          */}
      {/* ============================================================ */}
      <section className="bg-gradient-to-br from-[var(--w-primary)] to-[var(--w-primary-dark)] px-6 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Stop searching for jobs.<br />Let Woodhouse find them for you.
          </h2>
          <p className="mt-4 text-base text-white/60">
            Join professionals who are reclaiming their time with an AI recruiting agent.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--w-accent)] px-8 py-3.5 text-base font-bold text-white shadow-lg hover:bg-[var(--w-accent-light)] transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Footer                                                       */}
      {/* ============================================================ */}
      <footer className="border-t border-[var(--w-border)] bg-[var(--w-surface)] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <span className="text-lg font-bold text-[var(--w-primary)]">Woodhouse</span>
              <p className="mt-2 text-sm text-[var(--w-text-muted)] leading-relaxed">
                Your AI recruiting agent. Built to save you time.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--w-text-muted)] uppercase tracking-wider">
                Product
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/signup" className="text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] transition-colors">
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link href="/signin" className="text-[var(--w-text-secondary)] hover:text-[var(--w-text-primary)] transition-colors">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--w-text-muted)] uppercase tracking-wider">
                Legal
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <span className="text-[var(--w-text-muted)]">Privacy Policy</span>
                </li>
                <li>
                  <span className="text-[var(--w-text-muted)]">Terms of Service</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--w-text-muted)] uppercase tracking-wider">
                Contact
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <span className="text-[var(--w-text-muted)]">support@woodhouse.app</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--w-border)] pt-6 text-center text-xs text-[var(--w-text-muted)]">
            &copy; {new Date().getFullYear()} Woodhouse. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing Card (mobile)                                               */
/* ------------------------------------------------------------------ */

function PricingCard({
  name,
  price,
  period,
  description,
  cta,
  ctaHref,
  accent,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  accent: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        accent
          ? "border-[var(--w-accent)] bg-[var(--w-surface)] shadow-[var(--w-shadow-md)]"
          : "border-[var(--w-border)] bg-[var(--w-surface)] shadow-[var(--w-shadow-sm)]"
      }`}
    >
      {accent && (
        <span className="inline-block mb-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[var(--w-accent)]/10 text-[var(--w-accent)]">
          Most Popular
        </span>
      )}
      <h3 className="text-lg font-bold text-[var(--w-text-primary)]">{name}</h3>
      <div className="mt-2">
        <span className="text-3xl font-bold text-[var(--w-text-primary)]">{price}</span>
        {period && (
          <span className="text-sm text-[var(--w-text-muted)]">{period}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-[var(--w-text-secondary)]">{description}</p>
      <Link
        href={ctaHref}
        className={`mt-5 flex w-full items-center justify-center rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold transition-colors ${
          accent
            ? "bg-[var(--w-accent)] text-white hover:bg-[var(--w-accent-light)]"
            : "border border-[var(--w-border)] text-[var(--w-text-primary)] hover:bg-[var(--w-surface-alt)]"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
