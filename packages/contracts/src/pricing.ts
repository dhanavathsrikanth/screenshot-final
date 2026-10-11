export const PRICING_VERSION = "2026-10";

export const PLAN_CATALOG = {
  free: { name: "Free", priceUsd: 0, credits: 50, audience: "Try your first captures", description: "Explore the playground and test your integration." },
  starter: { name: "Starter", priceUsd: 9, credits: 1_000, audience: "For makers and side projects", description: "Capture landing pages, share previews, and build your first workflow." },
  pro: { name: "Pro", priceUsd: 29, credits: 5_000, audience: "For developers shipping regularly", description: "Bring captures into your app, reports, and recurring workflows." },
  growth: { name: "Growth", priceUsd: 79, credits: 15_000, audience: "For agencies and growing products", description: "Keep client projects and capture integrations moving with a larger allowance." },
  scale: { name: "Scale", priceUsd: 199, credits: 40_000, audience: "For larger capture workloads", description: "Plan capacity with us before moving to a larger allowance." },
} as const;

export type PlanName = keyof typeof PLAN_CATALOG;
export const LAUNCH_PLANS = ["starter", "pro", "growth"] as const;
export const CREDIT_PACKS = {
  credits_1k: { credits: 1_000, priceUsd: 12 },
  credits_5k: { credits: 5_000, priceUsd: 49 },
  credits_20k: { credits: 20_000, priceUsd: 179 },
} as const;

export function captureCreditCost(options: { format?: string; full_page?: boolean }): number {
  return options.format === "pdf" ? 3 : options.full_page ? 2 : 1;
}

export function allocateCaptureCredits(cost: number, monthlyAvailable: number, prepaidAvailable: number) {
  if (!Number.isSafeInteger(cost) || cost < 1 || cost > 3) throw new Error("Invalid capture credit cost");
  const monthly = Math.min(cost, Math.max(0, monthlyAvailable));
  const prepaid = cost - monthly;
  return prepaid > prepaidAvailable ? null : { monthly, prepaid };
}
