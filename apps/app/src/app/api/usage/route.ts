import { auth } from "@clerk/nextjs/server";
import { getBillingState } from "@screenshotapi/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const billing = await getBillingState(userId);
  return Response.json({ remaining: Math.max(0, billing.included - billing.used - billing.reserved) + billing.prepaidCredits, included: billing.included, reserved: billing.reserved }, {
    headers: { "cache-control": "no-store" },
  });
}
