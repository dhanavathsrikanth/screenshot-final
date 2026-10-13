import test from "node:test";
import assert from "node:assert/strict";
import { verifyDashboardRequest } from "@screenshotapi/queue";
import { createRemoteCaptureRuntime } from "./capture-remote-service.js";

test("remote dashboard transport signs authenticated identity, retains retry keys, and propagates billing errors", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.CAPTURE_INTENT_ENCRYPTION_KEY;
  const originalBase = process.env.SCREENSHOTAPI_API_URL;
  process.env.CAPTURE_INTENT_ENCRYPTION_KEY = "s".repeat(64);
  process.env.SCREENSHOTAPI_API_URL = "https://api.screenshotapi.tech";
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.CAPTURE_INTENT_ENCRYPTION_KEY; else process.env.CAPTURE_INTENT_ENCRYPTION_KEY = originalSecret;
    if (originalBase === undefined) delete process.env.SCREENSHOTAPI_API_URL; else process.env.SCREENSHOTAPI_API_URL = originalBase;
  });
  let billingFailure = false;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.screenshotapi.tech/internal/dashboard");
    assert.equal(init?.redirect, "error");
    const headers = new Headers(init?.headers);
    const body = String(init?.body);
    assert.equal(verifyDashboardRequest(process.env.CAPTURE_INTENT_ENCRYPTION_KEY, headers.get("x-dashboard-timestamp") ?? undefined,
      headers.get("x-dashboard-signature") ?? undefined, body), true);
    const input = JSON.parse(body);
    assert.equal(input.account_id, "user_test");
    assert.equal(input.key, "stable-retry-key");
    if (billingFailure) return Response.json({ error: { code: "quota_exceeded", message: "No credits remaining", request_id: "request-test", retriable: false } }, { status: 402 });
    return Response.json({ ok: true, data: { id: "job-test", state: "waiting" } });
  };
  const runtime = createRemoteCaptureRuntime();
  assert.equal((await runtime.service.submit({ accountId: "user_test" }, async () => ({ url: "https://example.com" }), "request-test", "async", "stable-retry-key")).id, "job-test");
  billingFailure = true;
  await assert.rejects(runtime.service.submit({ accountId: "user_test" }, {}, "request-test", "async", "stable-retry-key"), /No credits remaining/);
});
