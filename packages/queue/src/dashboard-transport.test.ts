import test from "node:test";
import assert from "node:assert/strict";
import { signDashboardRequest, verifyDashboardRequest } from "./dashboard-transport.js";

test("dashboard signatures bind the full request and expire after thirty seconds", () => {
  const secret = "a".repeat(64);
  const timestamp = "1791850000000";
  const body = JSON.stringify({ account_id: "user_test", operation: "submit" });
  const signature = signDashboardRequest(secret, timestamp, body);
  assert.equal(verifyDashboardRequest(secret, timestamp, signature, body, Number(timestamp)), true);
  assert.equal(verifyDashboardRequest(secret, timestamp, signature, body.replace("user_test", "user_other"), Number(timestamp)), false);
  assert.equal(verifyDashboardRequest(secret, timestamp, signature, body, Number(timestamp) + 30_001), false);
  assert.equal(verifyDashboardRequest("b".repeat(64), timestamp, signature, body, Number(timestamp)), false);
  assert.equal(verifyDashboardRequest(undefined, timestamp, signature, body, Number(timestamp)), false);
});
