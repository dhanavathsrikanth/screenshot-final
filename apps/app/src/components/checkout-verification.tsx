"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

export function CheckoutVerification({ paymentId }: { paymentId?: string }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"checking" | "verified" | "pending" | "error">("checking");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    let retries = 0;
    setState("checking");
    async function verify() {
      if (!paymentId) {
        setState("pending");
        setMessage("Checkout has returned. Your account updates after Dodo confirms the payment. Refresh to check your balance.");
        return;
      }
      try {
        const response = await fetch("/api/billing/verify", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ paymentId }), signal: controller.signal });
        const result = await response.json() as { verified?: boolean; error?: string };
        if (stopped) return;
        if (response.ok && result.verified) {
          setState("verified");
          setMessage("Payment verified. Your billing details have been refreshed.");
          router.refresh();
        } else if (response.status === 202 || response.status === 503) {
          if (++retries < 6) timer = setTimeout(verify, 3000);
          else { setState("pending"); setMessage("Payment confirmation is taking longer than usual. You can retry verification without paying again."); }
        } else { setState("error"); setMessage(result.error ?? "We could not verify this payment."); }
      } catch {
        if (!stopped) { setState("pending"); setMessage("Payment verification is temporarily unavailable. Please retry; you do not need to pay again."); }
      }
    }
    void verify();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [paymentId, attempt, router]);
  return <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-canvas px-4 py-3 text-sm text-ink-2">
    <p>{state === "checking" ? "Verifying your payment with Dodo…" : message}</p>
    {state === "pending" || state === "error" ? <Button onClick={() => { router.refresh(); setAttempt((value) => value + 1); }}>{paymentId ? "Retry verification" : "Refresh billing"}</Button> : null}
  </div>;
}
