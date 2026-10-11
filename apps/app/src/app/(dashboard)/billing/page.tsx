import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { CREDIT_PACKS, LAUNCH_PLANS, PLAN_CATALOG } from "@snapforge/contracts";
import { getBillingState } from "@snapforge/database";
import { Card, CardHeader, Meter, PageHeader, Stat } from "@/components/ui";
import { Icon } from "@/components/icons";
import { BillingButton, CustomerPortalButton } from "@/components/billing-actions";
import { BILLING_PRODUCTS } from "@/lib/billing";
import { formatNumber } from "@/lib/format";
import { CheckoutVerification } from "@/components/checkout-verification";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await auth();
  if (!userId) return null;
  const billing = await getBillingState(userId);
  const query = await searchParams;
  const remaining = Math.max(0, billing.included - billing.used - billing.reserved) + billing.prepaidCredits;
  const configured = Boolean(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PAYMENTS_WEBHOOK_KEY);
  const currentPlan = PLAN_CATALOG[billing.plan];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="A plan for your next capture" description="Start with a project. Grow into a workflow. Every plan keeps the same capture quality." action={configured && billing.customerId ? <CustomerPortalButton /> : undefined} />
      {query.checkout === "complete" ? <CheckoutVerification paymentId={typeof query.payment_id === "string" ? query.payment_id : undefined} /> : null}

      {configured && process.env.DODO_PAYMENTS_ENVIRONMENT !== "live_mode" ? <div role="status" className="rounded-md border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-ink-2"><span className="font-medium text-accent-ink">Billing test mode.</span> Checkout uses Dodo’s sandbox. No live payment is taken.</div> : null}
      {billing.refundedCreditDebt > 0 ? <div role="status" className="rounded-md border border-line bg-canvas px-4 py-3 text-sm text-ink-2">A refund included {formatNumber(billing.refundedCreditDebt)} credits already used or reserved. Your next prepaid purchase will cover these credits first. Your monthly allowance remains available.</div> : null}

      <div className="sf-stat-group grid sm:grid-cols-3">
        <Stat label="Credits used this month" value={formatNumber(billing.used)} sub={`${formatNumber(billing.included)} included on ${currentPlan.name}`} icon="play" />
        <Stat label="Credits available" value={formatNumber(remaining)} sub={`${formatNumber(billing.reserved)} reserved for captures in progress`} icon="bolt" />
        <Stat label="Prepaid balance" value={formatNumber(billing.prepaidCredits)} sub="Available after your monthly credits" icon="download" />
      </div>

      <Card>
        <CardHeader title="Your monthly allowance" description={`${currentPlan.name} · ${billing.subscription?.cancelAtPeriodEnd ? "ends at period close" : billing.subscription?.status ?? "free access"}`} />
        <div className="space-y-3 p-5">
          <Meter value={billing.included > 0 ? (billing.used + billing.reserved) / billing.included : 0} tone="success" />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-3"><span>{formatNumber(billing.used)} used · {formatNumber(billing.reserved)} reserved</span><span>{formatNumber(billing.included)} monthly credits</span></div>
          <p className="border-t border-line pt-3 text-xs text-ink-3">Monthly credits reset on the first day of each month (UTC) and do not roll over. Prepaid credits stay until used. No automatic overage charges.</p>
        </div>
      </Card>

      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Choose how you capture</h2>
        <p className="mt-1 text-sm text-ink-3">PNG, JPEG, WebP, PDF, device presets, API access, and capture history on every plan.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {LAUNCH_PLANS.map((key) => {
          const plan = PLAN_CATALOG[key];
          const featured = key === "pro";
          return (
            <Card key={key} className={`relative flex flex-col p-6 ${featured ? "border-accent/60 bg-accent/5" : ""}`}>
              {featured ? <span className="absolute -top-2.5 right-5 rounded-pill bg-accent px-2.5 py-0.5 text-[11px] font-medium text-n-0">Recommended</span> : null}
              <p className="text-xs font-medium text-accent-ink">{plan.audience}</p>
              <h3 className="mt-3 font-display text-xl font-semibold text-ink">{plan.name}</h3>
              <p className="mt-3 text-[36px] font-medium tracking-tight text-ink">${plan.priceUsd}<span className="ml-1 text-sm font-normal text-ink-3">/ month</span></p>
              <p className="mt-2 text-sm text-ink-2">{plan.description}</p>
              <div className="my-5 rounded-md border border-line bg-canvas p-4">
                <p className="font-display text-lg font-semibold text-ink">{formatNumber(plan.credits)} monthly credits</p>
                <p className="mt-1 text-xs text-ink-3">${(plan.priceUsd / plan.credits * 1000).toFixed(2)} per 1,000 included credits</p>
                <p className="mt-3 text-xs leading-5 text-ink-2">Up to {formatNumber(plan.credits)} viewport images, {formatNumber(plan.credits / 2)} full-page images, or {formatNumber(Math.floor(plan.credits / 3))} PDFs. Mix formats as you need.</p>
              </div>
              <ul className="flex-1 space-y-2.5">
                {["Full-page captures and high-resolution output", "API keys and webhook notifications", "Private capture links and PDF preview", "Failed captures return their credits"].map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-ink-2"><Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-ok-ink" />{feature}</li>)}
              </ul>
              <BillingButton product={key} available={configured && Boolean(BILLING_PRODUCTS[key].id)} current={billing.plan === key}>Choose {plan.name}</BillingButton>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div><h2 className="font-medium text-ink">Just exploring? Start free.</h2><p className="mt-1 text-sm text-ink-3">{PLAN_CATALOG.free.credits} credits every month. Try every output format before choosing a paid plan.</p></div>
          <Link href="/playground" className="rounded-md border border-line px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent">Try the playground</Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="One credit balance. Every output format." description="The credit cost is shown before you capture. Failed captures are refunded." />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {[{ title: "Viewport image", cost: "1 credit", note: "Capture the visible area in PNG, JPEG, or WebP." }, { title: "Full-page image", cost: "2 credits", note: "Include content below the initial viewport." }, { title: "PDF capture", cost: "3 credits", note: "Create a PDF with your chosen framing." }].map((item) => <div key={item.title} className="rounded-md border border-line bg-canvas p-4"><p className="text-sm text-ink-2">{item.title}</p><p className="mt-2 font-display text-lg font-semibold text-ink">{item.cost}</p><p className="mt-1 text-xs leading-5 text-ink-3">{item.note}</p></div>)}
        </div>
      </Card>

      <Card>
        <CardHeader title="Need a little more this month?" description="Optional one-time credit packs. No subscription change and no expiry." />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {Object.entries(CREDIT_PACKS).map(([key, pack]) => {
            const product = key as keyof typeof CREDIT_PACKS;
            return <div key={key} className="rounded-md border border-line bg-canvas p-4"><p className="font-display text-lg font-semibold text-ink">{formatNumber(pack.credits)} credits</p><p className="mt-1 text-sm text-ink-3">${pack.priceUsd} one time</p><BillingButton product={product} available={configured && Boolean(BILLING_PRODUCTS[product].id)}>Buy {formatNumber(pack.credits)} credits</BillingButton></div>;
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Good to know before you choose" description="Clear allowances, consistent quality, and control over your spend." />
        <div className="space-y-3 p-5 text-sm leading-6 text-ink-2">
          <p>Credits cover captures within the supported capture limits. Site loading, page length, and output size affect completion time. A plan does not guarantee access to every target website.</p>
          <p>Captures use monthly credits first, then prepaid credits. When the balance is too low for a capture, it pauses until you add credits or your monthly allowance resets.</p>
          <p>Prices are in USD; applicable taxes are shown at checkout. You can manage cancellation in the billing portal. Extra storage, managed proxies, and future paid features are not bundled into these allowances.</p>
          <p className="text-ink-3">Scale is planned at ${PLAN_CATALOG.scale.priceUsd}/month for {formatNumber(PLAN_CATALOG.scale.credits)} credits. It is not open for self-service checkout yet.</p>
        </div>
      </Card>
    </div>
  );
}
