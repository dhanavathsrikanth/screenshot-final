import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getBillingState, pool, recordDodoEvent, reserveCapture, settleCapture } from "./index.js";

const enabled = process.env.SCREENSHOTAPI_BILLING_TEST === "1";
const users: string[] = [];
const events: string[] = [];
function user() { const id = `billing-test-${randomUUID()}`; users.push(id); return id; }
function event() { const id = `billing-test-${randomUUID()}`; events.push(id); return id; }
const starter = { id: "test-starter", credits: 1000, kind: "subscription" as const, plan: "starter" as const };
const growth = { id: "test-growth", credits: 15000, kind: "subscription" as const, plan: "growth" as const };
afterEach(async () => {
  if (users.length) await pool.query("DELETE FROM accounts WHERE user_id = ANY($1::text[])", [users.splice(0)]);
  if (events.length) await pool.query("DELETE FROM dodo_webhook_events WHERE event_id = ANY($1::text[])", [events.splice(0)]);
});
after(async () => { await pool.end(); });

test("duplicate and concurrent purchases grant a payment only once", { skip: !enabled }, async () => {
  const userId = user();
  const id = randomUUID();
  await Promise.all(Array.from({ length: 5 }, () => recordDodoEvent({ eventId: event(), eventType: "payment.succeeded", userId,
    verify: async () => ({ creditPayment: { id, credits: 1000 } }) })));
  assert.equal((await getBillingState(userId)).prepaidCredits, 1000);
});

test("refunds and later retries converge to the provider's net credit grant", { skip: !enabled }, async () => {
  const userId = user();
  const id = randomUUID();
  for (const credits of [1000, 500, 500, 0, 0]) {
    await recordDodoEvent({ eventId: event(), eventType: "refund.succeeded", userId,
      verify: async () => ({ creditPayment: { id, credits } }) });
    assert.equal((await getBillingState(userId)).prepaidCredits, credits);
  }
});

test("a refund after consumption is retained as debt instead of granting free credits", { skip: !enabled }, async () => {
  const userId = user();
  const id = randomUUID();
  await recordDodoEvent({ eventId: event(), eventType: "payment.succeeded", userId, creditPayment: { id, credits: 1000 } });
  await pool.query("UPDATE accounts SET prepaid_credits = 200 WHERE user_id = $1", [userId]);
  await recordDodoEvent({ eventId: event(), eventType: "refund.succeeded", userId, creditPayment: { id, credits: 0 } });
  const refunded = await getBillingState(userId);
  assert.equal(refunded.prepaidCredits, 0);
  assert.equal(refunded.refundedCreditDebt, 800);
  await recordDodoEvent({ eventId: event(), eventType: "payment.succeeded", userId, creditPayment: { id: randomUUID(), credits: 1000 } });
  assert.equal((await getBillingState(userId)).prepaidCredits, 200);
});

test("verification failure rolls back the event so Dodo can retry successfully", { skip: !enabled }, async () => {
  const userId = user();
  const eventId = event();
  const input = { eventId, eventType: "payment.succeeded", userId };
  await assert.rejects(recordDodoEvent({ ...input, verify: async () => { throw new Error("Provider temporarily unavailable"); } }));
  await recordDodoEvent({ ...input, verify: async () => ({ creditPayment: { id: randomUUID(), credits: 1000 } }) });
  assert.equal((await getBillingState(userId)).prepaidCredits, 1000);
});

test("a failed reserved capture returns refunded credits against the debt correctly", { skip: !enabled }, async () => {
  const userId = user();
  const paymentId = randomUUID();
  await recordDodoEvent({ eventId: event(), eventType: "payment.succeeded", userId, creditPayment: { id: paymentId, credits: 1000 } });
  const warmup = randomUUID();
  await reserveCapture(userId, warmup);
  await settleCapture(warmup, false);
  await pool.query("UPDATE monthly_usage SET consumed = 50 WHERE user_id = $1", [userId]);
  const captureId = randomUUID();
  assert.equal(await reserveCapture(userId, captureId, 3), true);
  await recordDodoEvent({ eventId: event(), eventType: "refund.succeeded", userId, creditPayment: { id: paymentId, credits: 0 } });
  assert.equal((await getBillingState(userId)).refundedCreditDebt, 3);
  await settleCapture(captureId, false);
  const state = await getBillingState(userId);
  assert.equal(state.prepaidCredits, 0);
  assert.equal(state.refundedCreditDebt, 0);
});

test("subscription state is verified after serialization, so delayed events cannot reactivate cancelled accounts", { skip: !enabled }, async () => {
  const userId = user();
  const subscriptionId = randomUUID();
  let providerStatus = "active";
  await recordDodoEvent({ eventId: event(), eventType: "subscription.active", userId, subscriptionId,
    verify: async () => ({ product: starter, subscriptionStatus: providerStatus }) });
  providerStatus = "expired";
  await Promise.all(["subscription.expired", "subscription.active"].map((eventType) => recordDodoEvent({ eventId: event(), eventType, userId, subscriptionId,
    verify: async () => ({ product: starter, subscriptionStatus: providerStatus }) })));
  assert.equal((await getBillingState(userId)).plan, "free");
});

test("plan changes use the correct allowance and non-active subscriptions cannot upgrade", { skip: !enabled }, async () => {
  const userId = user();
  const subscriptionId = randomUUID();
  for (const [product, status, expected] of [[starter, "active", 1000], [growth, "active", 15000], [growth, "past_due", 50], [growth, "paused", 50]] as const) {
    await recordDodoEvent({ eventId: event(), eventType: "subscription.updated", userId, subscriptionId,
      verify: async () => ({ product, subscriptionStatus: status }) });
    assert.equal((await getBillingState(userId)).included, expected);
  }
});

test("subscriptions and payments cannot move between accounts", { skip: !enabled }, async () => {
  const first = user();
  const second = user();
  const subscriptionId = randomUUID();
  const paymentId = randomUUID();
  await recordDodoEvent({ eventId: event(), eventType: "subscription.active", userId: first, subscriptionId, product: starter, subscriptionStatus: "active" });
  await assert.rejects(recordDodoEvent({ eventId: event(), eventType: "subscription.active", userId: second, subscriptionId, product: growth, subscriptionStatus: "active" }), /account mismatch/);
  await recordDodoEvent({ eventId: event(), eventType: "payment.succeeded", userId: first, creditPayment: { id: paymentId, credits: 1000 } });
  await assert.rejects(recordDodoEvent({ eventId: event(), eventType: "payment.succeeded", userId: second, creditPayment: { id: paymentId, credits: 1000 } }), /account mismatch/);
  assert.equal((await getBillingState(first)).plan, "starter");
  assert.equal((await getBillingState(second)).prepaidCredits, 0);
});
