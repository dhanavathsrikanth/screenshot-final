export type DodoResource = {
  payment_id?: string;
  subscription_id?: string | null;
  product_id?: string;
  status?: string | null;
  currency?: string;
  quantity?: number;
  recurring_pre_tax_amount?: number;
  total_amount?: number;
  tax?: number | null;
  trial_period_days?: number;
  cancel_at_next_billing_date?: boolean;
  next_billing_date?: string | null;
  customer?: { customer_id?: string };
  metadata?: Record<string, unknown> | null;
  product_cart?: Array<{ product_id: string; quantity: number }> | null;
  refunds?: Array<{ status: string; amount?: number | null }>;
};

export function billingUserId(data: DodoResource) {
  const current = data.metadata?.screenshotapi_user_id;
  const legacy = data.metadata?.snapforge_user_id;
  if (current !== undefined && legacy !== undefined && current !== legacy) throw new Error("Conflicting payment account metadata");
  const value = current ?? legacy;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function verifyBillingOwner(data: DodoResource, userId: string) {
  if (billingUserId(data) !== userId || !data.customer?.customer_id) {
    throw new Error("Payment account could not be verified");
  }
}

export function verifiedSubscription(data: DodoResource, priceUsd: number) {
  if (!["pending", "active", "on_hold", "paused", "cancelled", "failed", "expired", "past_due"].includes(data.status ?? "")) {
    throw new Error("Unrecognized subscription status");
  }
  if (data.quantity !== 1 || data.currency !== "USD" || data.recurring_pre_tax_amount !== Math.round(priceUsd * 100) || data.trial_period_days !== 0) {
    throw new Error("Subscription does not match the purchased plan");
  }
  const end = data.next_billing_date ? new Date(data.next_billing_date) : null;
  if (end && !Number.isFinite(end.getTime())) throw new Error("Invalid subscription period");
  return { subscriptionStatus: data.status!, cancelAtPeriodEnd: data.cancel_at_next_billing_date === true, currentPeriodEnd: end };
}

export function verifiedCreditPayment(data: DodoResource, productId: string, priceUsd: number) {
  const cart = data.product_cart;
  if (data.status !== "succeeded" || data.currency !== "USD" || cart?.length !== 1 || cart[0].product_id !== productId || cart[0].quantity !== 1) {
    throw new Error("Credit purchase is not a verified successful payment");
  }
  const total = data.total_amount;
  const tax = data.tax ?? 0;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(tax) || tax < 0 || total! - tax !== Math.round(priceUsd * 100)) {
    throw new Error("Payment amount does not match the purchased credits");
  }
  const refunded = (data.refunds ?? []).filter((refund) => refund.status === "succeeded").reduce((sum, refund) => {
    if (!Number.isSafeInteger(refund.amount) || refund.amount! < 0) throw new Error("Invalid refund amount");
    return sum + refund.amount!;
  }, 0);
  return Math.max(0, 1 - Math.min(total!, refunded) / total!);
}
