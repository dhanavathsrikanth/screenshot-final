"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui";

type Balance = { remaining: number; included: number; reserved: number };

export function CreditNotice() {
  const pathname = usePathname();
  const [balance, setBalance] = useState<Balance | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const notified = useRef(false);
  const billingPage = pathname === "/billing";

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.hidden) return;
      refreshing = true;
      try {
        const response = await fetch("/api/usage", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json() as Balance;
        if (!controller.signal.aborted && Number.isFinite(payload.remaining) && Number.isFinite(payload.included) && Number.isFinite(payload.reserved)) setBalance(payload);
      } catch {} finally { refreshing = false; }
    };
    const required = () => { dialog.current?.showModal(); void refresh(); };
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("sf-credits-changed", refresh);
    window.addEventListener("sf-credits-required", required);
    document.addEventListener("visibilitychange", refresh);
    void refresh();
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("sf-credits-changed", refresh);
      window.removeEventListener("sf-credits-required", required);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  useEffect(() => {
    if (!balance) return;
    if (balance.remaining > 0) {
      notified.current = false;
      if (balance.remaining >= 3) dialog.current?.close();
    } else if (!billingPage && !notified.current) {
      notified.current = true;
      dialog.current?.showModal();
    }
  }, [balance, billingPage]);

  const empty = balance?.remaining === 0;
  const low = balance && balance.remaining > 0 && balance.remaining < balance.included * 0.1;
  const close = () => dialog.current?.close();
  return (
    <>
      {empty || low ? (
        <div role="status" aria-live="polite" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-ink">
          <div><p className="font-medium">{empty ? "No credits available" : `Credits running low · ${balance!.remaining.toLocaleString("en-US")} left`}</p><p className="mt-1 text-xs text-ink-2">{empty ? "Upgrade or add a one-time credit pack to continue capturing." : "Less than 10% of your monthly allowance is available. Upgrade or top up when you need more."}{balance!.reserved > 0 ? ` ${balance!.reserved.toLocaleString("en-US")} monthly credits are reserved for captures in progress.` : ""}</p></div>
          <div className="flex flex-wrap gap-4"><Link href="/billing#plans" className="font-medium text-accent-ink underline underline-offset-4">Upgrade plan</Link><Link href="/billing#credit-packs" className="font-medium text-accent-ink underline underline-offset-4">Top up credits</Link></div>
        </div>
      ) : null}
      <dialog ref={dialog} aria-labelledby="credit-dialog-title" aria-describedby="credit-dialog-description" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-canvas/70">
        <h2 id="credit-dialog-title" className="text-xl font-semibold">Add credits to keep capturing</h2>
        <p id="credit-dialog-description" className="mt-3 text-sm leading-6 text-ink-2">Your available balance cannot cover this capture. Upgrade your plan to continue using the service, or top up with a one-time credit pack without changing your plan.</p>
        <p className="mt-3 text-xs leading-5 text-ink-3">Monthly credits reset on the first day of each month (UTC). Top-up credits do not expire. Captures in progress keep their reserved credits.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link onClick={close} href="/billing#plans" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-n-0 focus-visible:outline-2 focus-visible:outline-accent">View upgrade plans</Link><Link onClick={close} href="/billing#credit-packs" className="rounded-md border border-line px-4 py-2 text-sm font-medium text-accent-ink focus-visible:outline-2 focus-visible:outline-accent">Top up credits</Link></div>
        <Button onClick={close} variant="ghost" className="mt-4">Continue browsing</Button>
      </dialog>
    </>
  );
}
