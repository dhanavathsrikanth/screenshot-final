import { findSubscriptionOwner, recordDodoEvent } from "@screenshotapi/database";
import { productForId } from "@/lib/billing";
import { billingUserId, verifyBillingOwner, verifiedCreditPayment, verifiedSubscription, type DodoResource } from "@/lib/billing-verification";
import { readDodoResource } from "@/lib/dodo-api";

function readPayload(payload: unknown) {
  return payload as { data: DodoResource & { refund_id?: string }; timestamp: Date | string; type: string; eventId?: string };
}

export async function handleSubscription(payload: unknown, verifiedUserId?: string) {
  const { data, timestamp, type, eventId } = readPayload(payload);
  const subscriptionId = data.subscription_id;
  if (!subscriptionId) throw new Error("Missing subscription ID");
  const owner = await findSubscriptionOwner(subscriptionId);
  if (!owner && !verifiedUserId && !productForId(data.product_id)) return;
  const metadataUserId = billingUserId(data);
  const userId = owner ?? verifiedUserId ?? (typeof metadataUserId === "string" ? metadataUserId : undefined);
  if (!userId) throw new Error("Missing subscription account");
  await recordDodoEvent({
    eventId: eventId ?? `${type}:${subscriptionId}:${String(timestamp)}`, eventType: type, userId, subscriptionId,
    verify: async () => {
      const current = await readDodoResource("subscriptions", subscriptionId);
      if (current.subscription_id !== subscriptionId) throw new Error("Subscription ID mismatch");
      verifyBillingOwner(current, userId);
      const product = productForId(current.product_id);
      if (product?.kind !== "subscription") throw new Error("Unknown subscription product");
      return { ...verifiedSubscription(current, product.priceUsd), customerId: current.customer!.customer_id,
        productId: product.id, product };
    },
  });
}

export async function handlePayment(payload: unknown, expectedUserId?: string) {
  const { data, type } = readPayload(payload);
  if (!data.payment_id || (type === "refund.succeeded" && !data.refund_id)) throw new Error("Missing payment or refund ID");
  const paymentId = data.payment_id;
  const payment = await readDodoResource("payments", paymentId);
  if (payment.payment_id !== paymentId) throw new Error("Payment ID mismatch");
  if (expectedUserId) verifyBillingOwner(payment, expectedUserId);
  if (payment.status !== "succeeded") throw new Error("Payment has not succeeded");
  if (payment.subscription_id) {
    const userId = billingUserId(payment);
    if (typeof userId !== "string") throw new Error("Missing payment account");
    await handleSubscription({ data: payment, type, timestamp: `payment:${paymentId}:${data.refund_id ?? ""}`,
      eventId: type === "refund.succeeded" ? `refund:${data.refund_id}` : `payment:${paymentId}` }, userId);
    return;
  }
  const product = productForId(payment.product_cart?.[0]?.product_id);
  if (!product) return;
  if (product.kind !== "credits") throw new Error("Unexpected payment product");
  const userId = billingUserId(payment);
  if (typeof userId !== "string") throw new Error("Missing payment account");
  await recordDodoEvent({ eventId: type === "refund.succeeded" ? `refund:${data.refund_id}` : `payment:${paymentId}`,
    eventType: type, userId,
    verify: async () => {
      const current = await readDodoResource("payments", paymentId);
      if (current.payment_id !== paymentId) throw new Error("Payment ID mismatch");
      verifyBillingOwner(current, userId);
      const fraction = verifiedCreditPayment(current, product.id, product.priceUsd);
      return { customerId: current.customer!.customer_id, productId: product.id,
        creditPayment: { id: paymentId, credits: Math.floor(product.credits * fraction) } };
    },
  });
}
