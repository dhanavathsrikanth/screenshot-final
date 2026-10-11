import { auth } from "@clerk/nextjs/server";
import { handlePayment } from "@/lib/billing-events";
import { readDodoResource } from "@/lib/dodo-api";
import { verifyBillingOwner } from "@/lib/billing-verification";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let paymentId: string;
  try {
    const body = await request.json() as { paymentId?: unknown };
    if (typeof body.paymentId !== "string" || !/^pay_[a-zA-Z0-9]+$/.test(body.paymentId) || body.paymentId.length > 100) {
      return Response.json({ error: "Invalid payment ID" }, { status: 400 });
    }
    paymentId = body.paymentId;
  } catch { return Response.json({ error: "Invalid payment ID" }, { status: 400 }); }
  try {
    const payment = await readDodoResource("payments", paymentId);
    try { verifyBillingOwner(payment, userId); } catch { return Response.json({ error: "Payment not found for this account" }, { status: 404 }); }
    if (["processing", "requires_payment_method", "requires_confirmation", "requires_customer_action"].includes(payment.status ?? "")) {
      return Response.json({ verified: false }, { status: 202 });
    }
    if (payment.status !== "succeeded") return Response.json({ error: "Payment was not completed. Your account has not been upgraded." }, { status: 400 });
    await handlePayment({ type: "payment.succeeded", data: { payment_id: paymentId } }, userId);
    return Response.json({ verified: true });
  } catch {
    return Response.json({ error: "We could not verify the payment yet. Please retry shortly." }, { status: 503 });
  }
}
