import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { CaptureFinalization } from "@screenshotapi/queue";
import { commitCapture, getBillingState, linkReservationToJob, pool, recordDodoEvent, reserveCapture, settleCapture } from "./index.js";

const enabled = process.env.SCREENSHOTAPI_PRICING_TEST === "1";
const accounts: string[] = [];
afterEach(async () => {
  if (accounts.length) await pool.query("DELETE FROM accounts WHERE user_id = ANY($1::text[])", [accounts.splice(0)]);
});
after(async () => { await pool.end(); });

async function account() {
  const id = `pricing-test-${randomUUID()}`;
  accounts.push(id);
  await getBillingState(id);
  return id;
}

async function boundary(id: string, prepaid: number) {
  const warmup = randomUUID();
  await reserveCapture(id, warmup);
  await settleCapture(warmup, false);
  await pool.query("UPDATE monthly_usage SET consumed = 49 WHERE user_id = $1", [id]);
  await pool.query("UPDATE accounts SET prepaid_credits = $2 WHERE user_id = $1", [id, prepaid]);
}

function finalization(accountId: string, jobId: string, ok: boolean): CaptureFinalization {
  const at = Date.now();
  return { accountId, jobId, reservationId: jobId,
    snapshot: { id: jobId, request_id: jobId, state: ok ? "completed" : "failed", mode: "async", progress: 100, attempts_made: 1,
      attempt_budget: 3, enqueued_at: at, webhook: null,
      result: { request_id: jobId, mode: "async", ok, duration_ms: 100, attempts_made: 1, enqueued_at: at, completed_at: at,
        ...(ok ? { data: { url: "https://example.com", final_url: "https://example.com", cached: false, blocked_requests: 0, format: "pdf", width: 1280, height: 720, bytes: 100, duration_ms: 100, cdn_url: "https://files.example/c.pdf" } }
          : { error: { code: "render_timeout", message: "Timeout", retriable: false, request_id: jobId } }),
      } },
    entry: { id: jobId, at, ok, url: "https://example.com", format: "pdf", width: 1280, height: 720, bytes: ok ? 100 : 0,
      duration_ms: 100, blocked_requests: 0, code: ok ? null : "render_timeout", message: ok ? null : "Timeout", request_id: jobId },
  };
}

test("weighted reservations refund both monthly and prepaid credits exactly once", { skip: !enabled }, async () => {
  const id = await account();
  await boundary(id, 2);
  const job = randomUUID();
  assert.equal(await reserveCapture(id, job, 3), true);
  assert.equal((await getBillingState(id)).reserved, 1);
  assert.equal((await getBillingState(id)).prepaidCredits, 0);
  await Promise.all(Array.from({ length: 3 }, () => settleCapture(job, false)));
  const state = await getBillingState(id);
  assert.equal(state.used, 49);
  assert.equal(state.reserved, 0);
  assert.equal(state.prepaidCredits, 2);
});

test("concurrent finalizers consume a mixed PDF reservation only once", { skip: !enabled }, async () => {
  const id = await account();
  await boundary(id, 2);
  const job = randomUUID();
  await reserveCapture(id, job, 3);
  await linkReservationToJob(id, job, job);
  await Promise.all(Array.from({ length: 3 }, () => commitCapture(finalization(id, job, true))));
  const state = await getBillingState(id);
  assert.equal(state.used, 50);
  assert.equal(state.reserved, 0);
  assert.equal(state.prepaidCredits, 0);
});

test("failed durable finalization refunds a mixed PDF reservation", { skip: !enabled }, async () => {
  const id = await account();
  await boundary(id, 2);
  const job = randomUUID();
  await reserveCapture(id, job, 3);
  await linkReservationToJob(id, job, job);
  await commitCapture(finalization(id, job, false));
  await commitCapture(finalization(id, job, false));
  const state = await getBillingState(id);
  assert.equal(state.used, 49);
  assert.equal(state.reserved, 0);
  assert.equal(state.prepaidCredits, 2);
});

test("insufficient combined balance never creates a partial reservation", { skip: !enabled }, async () => {
  const id = await account();
  await boundary(id, 1);
  assert.equal(await reserveCapture(id, randomUUID(), 3), false);
  const state = await getBillingState(id);
  assert.equal(state.reserved, 0);
  assert.equal(state.prepaidCredits, 1);
});

test("concurrent full-page reservations cannot exceed the allowance", { skip: !enabled }, async () => {
  const id = await account();
  await boundary(id, 0);
  await pool.query("UPDATE monthly_usage SET consumed = 48 WHERE user_id = $1", [id]);
  const jobs = Array.from({ length: 5 }, () => randomUUID());
  const accepted = await Promise.all(jobs.map((job) => reserveCapture(id, job, 2)));
  assert.equal(accepted.filter(Boolean).length, 1);
  assert.equal((await getBillingState(id)).reserved, 2);
  await Promise.all(jobs.map((job) => settleCapture(job, false)));
  assert.equal((await getBillingState(id)).reserved, 0);
});

test("legacy reservations retain their original one-credit refund", { skip: !enabled }, async () => {
  const id = await account();
  const job = randomUUID();
  await reserveCapture(id, job);
  await pool.query("UPDATE capture_reservations SET monthly_credits = NULL WHERE request_id = $1", [job]);
  await settleCapture(job, false);
  assert.equal((await getBillingState(id)).reserved, 0);
});

test("Starter and Growth payment events use their catalog allowance", { skip: !enabled }, async () => {
  const id = await account();
  for (const [plan, credits] of [["starter", 1000], ["growth", 15000]] as const) {
    const eventId = `pricing-test-${randomUUID()}`;
    try {
      const input = { eventId, eventType: "subscription.active", userId: id, subscriptionId: `sub-${randomUUID()}`,
        subscriptionStatus: "active", product: { id: `product-${plan}`, credits, kind: "subscription" as const, plan } };
      assert.equal(await recordDodoEvent(input), true);
      assert.equal(await recordDodoEvent(input), false);
      assert.equal((await getBillingState(id)).included, credits);
    } finally { await pool.query("DELETE FROM dodo_webhook_events WHERE event_id = $1", [eventId]); }
  }
});
