export function billingPriceMatches(value: unknown, priceUsd: number, kind: "subscription" | "credits"): boolean {
  if (!value || typeof value !== "object") return false;
  const product = value as { price?: unknown };
  if (!product.price || typeof product.price !== "object") return false;
  const price = product.price as Record<string, unknown>;
  if (price.currency !== "USD" || price.price !== Math.round(priceUsd * 100) || price.tax_inclusive === true ||
    price.pay_what_you_want === true || price.purchasing_power_parity === true ||
    (price.discount_bps ?? price.discount ?? 0) !== 0) return false;
  return kind === "credits" ? price.type === "one_time_price" : price.type === "recurring_price" &&
    price.payment_frequency_count === 1 && String(price.payment_frequency_interval).toLowerCase() === "month" &&
    !price.trial_period_days && !price.trial_price && !price.trial_amount;
}
