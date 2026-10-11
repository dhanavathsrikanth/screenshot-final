import test from "node:test";
import assert from "node:assert/strict";
import { allocateCaptureCredits, captureCreditCost, PLAN_CATALOG } from "./pricing.js";

test("capture credits preserve PDF pricing regardless of full-page framing", () => {
  assert.equal(captureCreditCost({ format: "webp" }), 1);
  assert.equal(captureCreditCost({ format: "png", full_page: true }), 2);
  assert.equal(captureCreditCost({ format: "pdf", full_page: false }), 3);
  assert.equal(captureCreditCost({ format: "pdf", full_page: true }), 3);
});

test("credit allocation uses the remaining monthly allowance before prepaid credits", () => {
  assert.deepEqual(allocateCaptureCredits(3, 1, 2), { monthly: 1, prepaid: 2 });
  assert.deepEqual(allocateCaptureCredits(2, 5, 0), { monthly: 2, prepaid: 0 });
  assert.deepEqual(allocateCaptureCredits(3, -5, 3), { monthly: 0, prepaid: 3 });
  assert.equal(allocateCaptureCredits(3, 1, 1), null);
  assert.throws(() => allocateCaptureCredits(0, 50, 50));
  assert.throws(() => allocateCaptureCredits(1.5, 50, 50));
  assert.deepEqual(Object.values(PLAN_CATALOG).map((plan) => [plan.priceUsd, plan.credits]), [[0, 50], [9, 1000], [29, 5000], [79, 15000], [199, 40000]]);
});
