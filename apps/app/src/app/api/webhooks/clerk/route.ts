import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { syncClerkAccount } from "@snapforge/database";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  if (event.type !== "user.created" && event.type !== "user.updated") {
    return Response.json({ received: true });
  }
  try {
    const userId = event.data.id;
    await syncClerkAccount(userId, async () => {
      const client = await clerkClient();
      try {
        const user = await client.users.getUser(userId);
        return {
          email: user.emailAddresses.find((address: { id: string; emailAddress: string }) => address.id === user.primaryEmailAddressId)?.emailAddress ?? null,
          displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null,
        };
      } catch (error) {
        if (typeof error === "object" && error !== null && "status" in error && error.status === 404) return null;
        throw error;
      }
    });
    return Response.json({ received: true });
  } catch {
    console.error("Clerk account synchronization failed; delivery will be retried");
    return Response.json({ error: "Account synchronization temporarily unavailable" }, { status: 503 });
  }
}
