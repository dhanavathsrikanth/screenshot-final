import { Webhooks } from "@dodopayments/nextjs";
import { handlePayment, handleSubscription } from "@/lib/billing-events";

const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
const webhookHandler = webhookKey ? Webhooks({
  webhookKey,
  onPaymentSucceeded: handlePayment,
  onRefundSucceeded: handlePayment,
  onSubscriptionActive: handleSubscription,
  onSubscriptionRenewed: handleSubscription,
  onSubscriptionUpdated: handleSubscription,
  onSubscriptionPlanChanged: handleSubscription,
  onSubscriptionFailed: handleSubscription,
  onSubscriptionExpired: handleSubscription,
  onSubscriptionOnHold: handleSubscription,
  onSubscriptionPaused: handleSubscription,
  onSubscriptionUnpaused: handleSubscription,
  onSubscriptionCancelled: handleSubscription,
}) : null;

export async function POST(request: Request) {
  if (!webhookHandler) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  try {
    return await webhookHandler(request as Parameters<typeof webhookHandler>[0]);
  } catch {
    console.error("Billing webhook processing failed; payment verification will be retried");
    return Response.json({ error: "Payment verification temporarily unavailable" }, { status: 503 });
  }
}
