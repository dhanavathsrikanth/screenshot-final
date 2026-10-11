"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BillingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <section role="alert" className="rounded-lg border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-semibold text-ink">Billing could not load</h1>
      <p className="mt-2 text-sm text-ink-2">We couldn’t retrieve your current plan and credit balance. Please try again.</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => { router.refresh(); reset(); }} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-n-0 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent">Try again</button>
        <Link href="/pricing" className="text-sm text-accent-ink hover:underline">View plan prices</Link>
      </div>
    </section>
  );
}
