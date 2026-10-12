import type { PaidProduct, PlanName } from "@screenshotapi/database";
import { CREDIT_PACKS, PLAN_CATALOG } from "@screenshotapi/contracts";

type ProductDefinition = Omit<PaidProduct, "id"> & { id: string | undefined; priceUsd: number };

export const BILLING_PRODUCTS = {
  starter: { id: process.env.DODO_PRODUCT_STARTER_2026_10, credits: PLAN_CATALOG.starter.credits, priceUsd: PLAN_CATALOG.starter.priceUsd, kind: "subscription", plan: "starter" },
  pro: { id: process.env.DODO_PRODUCT_PRO_2026_10, credits: PLAN_CATALOG.pro.credits, priceUsd: PLAN_CATALOG.pro.priceUsd, kind: "subscription", plan: "pro" },
  growth: { id: process.env.DODO_PRODUCT_GROWTH_2026_10, credits: PLAN_CATALOG.growth.credits, priceUsd: PLAN_CATALOG.growth.priceUsd, kind: "subscription", plan: "growth" },
  credits_1k: { id: process.env.DODO_PRODUCT_CREDITS_1K_2026_10, ...CREDIT_PACKS.credits_1k, kind: "credits" },
  credits_5k: { id: process.env.DODO_PRODUCT_CREDITS_5K_2026_10, ...CREDIT_PACKS.credits_5k, kind: "credits" },
  credits_20k: { id: process.env.DODO_PRODUCT_CREDITS_20K_2026_10, ...CREDIT_PACKS.credits_20k, kind: "credits" },
} as const satisfies Record<string, ProductDefinition>;

export type BillingProduct = keyof typeof BILLING_PRODUCTS;

export function productForId(id: string | undefined): (PaidProduct & { id: string; priceUsd: number }) | undefined {
  const product = Object.values(BILLING_PRODUCTS).find((candidate) => candidate.id && candidate.id === id);
  return product?.id ? product as PaidProduct & { id: string; priceUsd: number } : undefined;
}

export function planFromMetadata(value: unknown): PlanName | undefined {
  return typeof value === "string" && Object.hasOwn(PLAN_CATALOG, value) ? value as PlanName : undefined;
}
