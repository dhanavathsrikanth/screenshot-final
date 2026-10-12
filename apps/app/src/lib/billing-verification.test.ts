import test from "node:test";
import assert from "node:assert/strict";
import { verifiedCreditPayment, verifiedSubscription, verifyBillingOwner, type DodoResource } from "./billing-verification.js";

const payment: DodoResource = { payment_id: "pay-1", status: "succeeded", currency: "USD", total_amount: 1320, tax: 120,
  customer: { customer_id: "cus-1" }, metadata: { snapforge_user_id: "user-1" },
  product_cart: [{ product_id: "pack-1", quantity: 1 }], refunds: [] };
const subscription: DodoResource = { status: "active", quantity: 1, currency: "USD", recurring_pre_tax_amount: 900,
  trial_period_days: 0, cancel_at_next_billing_date: false, next_billing_date: "2026-11-11T00:00:00Z" };

test("only the account attached by checkout can receive payment benefits", () => {
  verifyBillingOwner(payment, "user-1");
  assert.throws(() => verifyBillingOwner(payment, "user-2"));
  assert.throws(() => verifyBillingOwner({ ...payment, metadata: {} }, "user-1"));
});

test("renamed checkout metadata preserves legacy owners and rejects conflicting identities", () => {
  verifyBillingOwner({ ...payment, metadata: { screenshotapi_user_id: "user-1" } }, "user-1");
  verifyBillingOwner({ ...payment, metadata: { screenshotapi_user_id: "user-1", snapforge_user_id: "user-1" } }, "user-1");
  assert.throws(() => verifyBillingOwner({ ...payment, metadata: { screenshotapi_user_id: "user-2", snapforge_user_id: "user-1" } }, "user-1"));
  assert.throws(() => verifyBillingOwner({ ...payment, metadata: { screenshotapi_user_id: 1 } }, "user-1"));
});

test("credits require a paid cart and exact pre-tax price", () => {
  assert.equal(verifiedCreditPayment(payment, "pack-1", 12), 1);
  for (const change of [{ status: "failed" }, { status: "processing" }, { total_amount: 120 }, { tax: -1 }, { currency: "EUR" },
    { product_cart: [{ product_id: "pack-1", quantity: 0 }] }, { product_cart: [{ product_id: "pack-1", quantity: 1.5 }] },
    { product_cart: [{ product_id: "pack-1", quantity: 1 }, { product_id: "pack-2", quantity: 1 }] }]) {
    assert.throws(() => verifiedCreditPayment({ ...payment, ...change }, "pack-1", 12));
  }
});

test("confirmed refunds reduce entitlement proportionally; pending and failed refunds do not", () => {
  assert.equal(verifiedCreditPayment({ ...payment, refunds: [{ status: "succeeded", amount: 660 }] }, "pack-1", 12), 0.5);
  assert.equal(verifiedCreditPayment({ ...payment, refunds: [{ status: "succeeded", amount: 1320 }] }, "pack-1", 12), 0);
  assert.equal(verifiedCreditPayment({ ...payment, refunds: [{ status: "failed", amount: 1320 }, { status: "pending", amount: 1320 }] }, "pack-1", 12), 1);
  assert.throws(() => verifiedCreditPayment({ ...payment, refunds: [{ status: "succeeded" }] }, "pack-1", 12));
});

test("subscription state comes from the provider, including cancellation and unpaid states", () => {
  assert.equal(verifiedSubscription(subscription, 9).subscriptionStatus, "active");
  assert.equal(verifiedSubscription({ ...subscription, status: "cancelled", cancel_at_next_billing_date: true }, 9).subscriptionStatus, "cancelled");
  assert.equal(verifiedSubscription({ ...subscription, status: "on_hold" }, 9).subscriptionStatus, "on_hold");
  for (const change of [{ status: undefined }, { status: "unknown" }, { recurring_pre_tax_amount: 1 }, { trial_period_days: 7 }, { quantity: 2 }, { next_billing_date: "invalid" }]) {
    assert.throws(() => verifiedSubscription({ ...subscription, ...change }, 9));
  }
});
