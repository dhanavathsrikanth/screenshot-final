import type { DodoResource } from "./billing-verification";

export async function readDodoResource(resource: "payments" | "subscriptions", id: string): Promise<DodoResource> {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) throw new Error("Payment verification is not configured");
  const base = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
  const response = await fetch(`${base}/${resource}/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Payment verification unavailable (${response.status})`);
  return response.json();
}
