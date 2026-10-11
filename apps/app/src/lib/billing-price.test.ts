import test from "node:test";
import assert from "node:assert/strict";
import { billingPriceMatches } from "./billing-price.js";

const monthly = { type: "recurring_price", price: 2900, currency: "USD", payment_frequency_count: 1, payment_frequency_interval: "Month" };
test("checkout accepts the advertised monthly price and pack price", () => {
  assert.equal(billingPriceMatches({ price: monthly }, 29, "subscription"), true);
  assert.equal(billingPriceMatches({ price: { type: "one_time_price", price: 1200, currency: "USD" } }, 12, "credits"), true);
});
test("checkout rejects mismatched amounts, currencies, intervals, and product types", () => {
  for (const patch of [{ price: 19900 }, { currency: "EUR" }, { payment_frequency_interval: "Year" }, { payment_frequency_count: 12 }, { type: "one_time_price" }]) {
    assert.equal(billingPriceMatches({ price: { ...monthly, ...patch } }, 29, "subscription"), false);
  }
  assert.equal(billingPriceMatches({ price: monthly }, 29, "credits"), false);
  assert.equal(billingPriceMatches(null, 29, "subscription"), false);
});
test("unpriced discounts, trials, and flexible prices cannot silently reduce plan revenue", () => {
  for (const patch of [{ discount: 50 }, { discount_bps: 1000 }, { purchasing_power_parity: true }, { tax_inclusive: true }, { pay_what_you_want: true }, { trial_period_days: 14 }, { trial_price: 100 }, { trial_amount: 100 }]) {
    assert.equal(billingPriceMatches({ price: { ...monthly, ...patch } }, 29, "subscription"), false);
  }
});
