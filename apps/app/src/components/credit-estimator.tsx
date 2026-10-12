"use client";

import { useState } from "react";
import { LAUNCH_PLANS, PLAN_CATALOG } from "@screenshotapi/contracts";
import { Card, CardHeader } from "./ui";

export function CreditEstimator() {
  const [counts, setCounts] = useState([1000, 100, 50]);
  const credits = counts[0] + counts[1] * 2 + counts[2] * 3;
  const recommended = credits <= PLAN_CATALOG.free.credits ? "free" : LAUNCH_PLANS.find((key) => PLAN_CATALOG[key].credits >= credits);
  return (
    <Card>
      <CardHeader title="Find your starting plan" description="Estimate your monthly mix. Every plan includes the same output formats and quality." />
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_240px]">
        <div className="grid gap-4 sm:grid-cols-3">
          {["Viewport images", "Full-page images", "PDFs"].map((label, index) => <label key={label} className="space-y-2 text-sm text-ink-2"><span className="block">{label}</span><input type="number" min={0} max={1000000} step={1} value={counts[index]} onChange={(event) => setCounts(counts.map((count, position) => position === index ? Math.max(0, Math.min(1000000, Math.floor(Number(event.target.value) || 0))) : count))} className="min-h-11 w-full rounded-md border border-line bg-canvas px-3 text-ink" /><span className="block text-xs text-ink-3">{index + 1} {index === 0 ? "credit" : "credits"} each</span></label>)}
        </div>
        <div className="rounded-md border border-line bg-accent/5 p-4" role="status" aria-live="polite" aria-atomic="true"><p className="text-xs text-ink-3">Estimated monthly use</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{credits.toLocaleString("en-US")} credits</p><p className="mt-2 text-sm text-accent-ink">{recommended ? `${PLAN_CATALOG[recommended].name} fits this allowance · $${PLAN_CATALOG[recommended].priceUsd}/month` : "Beyond Growth? Add optional credits or discuss future capacity."}</p></div>
      </div>
    </Card>
  );
}
