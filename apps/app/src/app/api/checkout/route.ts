import { Checkout } from "@dodopayments/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { BILLING_PRODUCTS, type BillingProduct } from "@/lib/billing";
import { ensureAccount, getSubscription } from "@screenshotapi/database";
import { billingPriceMatches } from "@/lib/billing-price";

const checkout = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY ?? "",
  returnUrl: process.env.DODO_PAYMENTS_RETURN_URL,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  type: "session",
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.DODO_PAYMENTS_API_KEY || !process.env.DODO_PAYMENTS_WEBHOOK_KEY) return Response.json({ error: "Billing is not configured" }, { status: 503 });

  let productKey: BillingProduct;
  try {
    const body = await request.json() as { product?: string };
    if (!body.product || !Object.hasOwn(BILLING_PRODUCTS, body.product)) return Response.json({ error: "Unknown product" }, { status: 400 });
    productKey = body.product as BillingProduct;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const product = BILLING_PRODUCTS[productKey];
  if (!product.id) return Response.json({ error: "This product is not configured in Dodo Payments" }, { status: 503 });
  try {
    const base = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
    const response = await fetch(`${base}/products/${encodeURIComponent(product.id)}`, {
      headers: { authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}` }, cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !billingPriceMatches(await response.json(), product.priceUsd, product.kind)) {
      return Response.json({ error: "Checkout is temporarily unavailable. Please try again later." }, { status: 503 });
    }
  } catch {
    return Response.json({ error: "Checkout is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  if (product.kind === "subscription") {
    const subscription = await getSubscription(userId);
    if (subscription && ["active", "past_due", "on_hold", "paused", "pending"].includes(subscription.status)) {
      return Response.json({ error: "Manage your existing subscription in the billing portal before choosing another plan." }, { status: 409 });
    }
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return Response.json({ error: "Your account needs a verified email address" }, { status: 400 });
  await ensureAccount(userId, { email, displayName: user.fullName });

  const payload = {
    billing_currency: "USD",
    product_cart: [{ product_id: product.id, quantity: 1 }],
    customer: { email, ...(user.fullName ? { name: user.fullName } : {}) },
    metadata: { screenshotapi_user_id: userId, snapforge_user_id: userId, screenshotapi_product: productKey },
    return_url: process.env.DODO_PAYMENTS_RETURN_URL ?? new URL("/billing?checkout=complete", request.url).toString(),
  };
  const forwarded = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(payload),
  });
  return checkout(forwarded);
}
