import { createHmac, timingSafeEqual } from "node:crypto";

export function signDashboardRequest(secret: string, timestamp: string, body: string): string {
  if (secret.length < 32) throw new Error("Dashboard transport secret is not configured");
  return createHmac("sha256", secret).update(`screenshotapi:dashboard:v1\n${timestamp}\n${body}`).digest("hex");
}

export function verifyDashboardRequest(secret: string | undefined, timestamp: string | undefined, signature: string | undefined, body: string, now = Date.now()): boolean {
  if (!secret || secret.length < 32 || !timestamp || !signature || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > 30_000) return false;
  return timingSafeEqual(Buffer.from(signDashboardRequest(secret, timestamp, body), "hex"), Buffer.from(signature, "hex"));
}
