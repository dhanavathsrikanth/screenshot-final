import Link from "next/link";
import type { Metadata } from "next";
import { LAUNCH_PLANS, PLAN_CATALOG } from "@screenshotapi/contracts";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CreditEstimator } from "@/components/credit-estimator";

export const metadata: Metadata = { title: "Screenshot API pricing · ScreenshotAPI", description: "Screenshot API plans from $9/month. PNG, JPEG, WebP, PDF and full-page captures with clear credit pricing. Start with 50 free credits." };

export default function PricingPage() {
  return (
    <main data-theme="dark" className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        <nav aria-label="Main navigation" className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-6">
          <Link href="/pricing" className="font-display text-xl font-semibold tracking-tight">ScreenshotAPI.</Link>
          <div className="flex items-center gap-5 text-sm"><Link href="https://docs.screenshotapi.tech" className="text-ink-2 hover:text-accent-ink">Documentation</Link><Link href="/billing" className="text-ink-2 hover:text-accent-ink">Your workspace</Link><Link href="/sign-up" className="rounded-md bg-accent px-4 py-2 font-medium text-n-0 hover:bg-accent-hover">Start free</Link></div>
        </nav>
        <header className="max-w-3xl py-12 sm:py-16">
          <p className="text-sm font-medium text-accent-ink">Screenshot API + capture playground</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">One URL.<br />A preview, a report, your next workflow.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-2">Capture pages for your app, client projects, and automated reports. Choose the allowance you need. Keep the same image quality as you grow.</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-2">{["50 free credits every month", "Failed captures refunded", "No automatic overage charges"].map((text) => <span key={text} className="flex items-center gap-2"><Icon name="check" className="size-4 text-ok-ink" />{text}</span>)}</div>
        </header>
        <section aria-labelledby="plans-heading" className="space-y-6">
          <div><h2 id="plans-heading" className="font-display text-2xl font-semibold">Start small. Build a capture workflow.</h2><p className="mt-2 text-sm text-ink-3">Monthly prices in USD. Applicable taxes are shown at checkout.</p></div>
          <div className="grid gap-4 lg:grid-cols-3">
            {LAUNCH_PLANS.map((key) => {
              const plan = PLAN_CATALOG[key];
              return <Card key={key} className={`relative flex flex-col p-6 ${key === "pro" ? "border-accent/60 bg-accent/5" : ""}`}>
                {key === "pro" && <span className="absolute -top-2.5 right-5 rounded-pill bg-accent px-3 py-1 text-xs font-medium text-n-0">Recommended</span>}
                <p className="text-xs font-medium text-accent-ink">{plan.audience}</p><h3 className="mt-3 font-display text-xl font-semibold">{plan.name}</h3>
                <p className="mt-4 font-display text-4xl font-semibold">${plan.priceUsd}<span className="ml-1 text-sm font-normal text-ink-3">/ month</span></p><p className="mt-3 min-h-12 text-sm leading-6 text-ink-2">{plan.description}</p>
                <p className="mt-6 border-t border-line pt-5 font-display text-lg font-semibold">{plan.credits.toLocaleString("en-US")} monthly credits</p>
                <p className="mt-1 min-h-8 text-xs text-ink-3">Up to {plan.credits.toLocaleString("en-US")} viewport images or {(plan.credits / 2).toLocaleString("en-US")} full-page images.</p>
                <ul className="my-6 flex-1 space-y-3 text-sm text-ink-2">{["PNG, JPEG, WebP, and PDF", "Full-page and device captures", "API access and webhook notifications", "Private capture links and PDF preview"].map((text) => <li key={text} className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-ok-ink" />{text}</li>)}</ul>
                <Link href={`/billing?plan=${key}`} className="rounded-md bg-accent px-4 py-3 text-center text-sm font-medium text-n-0 hover:bg-accent-hover">Choose {plan.name}</Link>
              </Card>;
            })}
          </div>
          <p className="text-sm leading-6 text-ink-3">1 credit per viewport image · 2 per full-page image · 3 per PDF. Mix formats within your allowance. Paid checkout availability is shown in your workspace.</p>
          <CreditEstimator />
        </section>
        <section aria-labelledby="questions-heading" className="mt-12">
          <h2 id="questions-heading" className="font-display text-2xl font-semibold">Before your first capture</h2>
          <div className="mt-5 divide-y divide-line rounded-lg border border-line px-5">
            {[
              ["Can I try it before paying?", "Yes. Free includes 50 monthly credits and every output format. Use the playground to check your pages and test the API before choosing a plan."],
              ["Does a cheaper plan reduce quality?", "Every plan uses the same capture engine and output settings. Choose your device, format, resolution, and full-page framing. Plans change the credit allowance."],
              ["What happens when a capture fails?", "Its reserved credits are returned. Retries of the same request with the same idempotency key reuse its reservation rather than charging for another job."],
              ["What happens when I use my allowance?", "Captures pause when the balance is too low. Optional packs add 1,000 credits for $12, 5,000 for $49, or 20,000 for $179. Prepaid credits do not expire. No automatic overage charges."],
              ["When do monthly credits reset?", "On the first day of each month, in UTC. Monthly credits do not roll over. Prepaid credits are used after your monthly allowance."],
              ["What is included in the price?", "Captures within the supported limits, playground access, API keys, and capture history. Completion time depends on the target page. Managed proxies, extra storage, future paid features, and contractual SLAs are not bundled."],
            ].map(([question, answer]) => <details key={question} className="py-4"><summary className="cursor-pointer text-sm font-medium">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-ink-2">{answer}</p></details>)}
          </div>
        </section>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-ink-3"><p>Build your first workflow with {PLAN_CATALOG.free.credits} free credits.</p><Link href="/sign-up" className="font-medium text-accent-ink">Create your workspace →</Link></footer>
      </div>
    </main>
  );
}
