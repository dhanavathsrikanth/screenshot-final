import test from "node:test";
import assert from "node:assert/strict";
import { retryBillingConnection } from "./connection-retry.js";

test("billing retries a wrapped connection failure once", async () => {
  let attempts = 0;
  const result = await retryBillingConnection(async () => {
    if (++attempts === 1) throw new Error("Failed query", { cause: new Error("Connection terminated due to connection timeout") });
    return { prepaidCredits: 7 };
  });
  assert.deepEqual(result, { prepaidCredits: 7 });
  assert.equal(attempts, 2);
});

test("billing does not retry SQL failures", async () => {
  let attempts = 0;
  const failure = Object.assign(new Error("constraint violation"), { code: "23505" });
  await assert.rejects(retryBillingConnection(async () => { attempts++; throw failure; }), (error) => error === failure);
  assert.equal(attempts, 1);
});

test("billing stops after its second connection failure", async () => {
  let attempts = 0;
  await assert.rejects(retryBillingConnection(async () => {
    attempts++;
    throw Object.assign(new Error("socket closed"), { code: "ECONNRESET" });
  }), /socket closed/);
  assert.equal(attempts, 2);
});
