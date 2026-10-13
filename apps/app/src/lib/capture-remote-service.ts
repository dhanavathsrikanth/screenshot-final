import { errorEnvelopeSchema, ScreenshotAPIError } from "@screenshotapi/contracts";
import { signDashboardRequest, type CaptureService, type JobSnapshot } from "@screenshotapi/queue";

export function createRemoteCaptureRuntime() {
  const base = process.env.SCREENSHOTAPI_API_URL ?? "https://api.screenshotapi.tech";
  if (new URL(base).protocol !== "https:") throw new Error("Capture API requires HTTPS");
  const call = async (input: Record<string, unknown>): Promise<JobSnapshot> => {
    const body = JSON.stringify(input);
    const timestamp = String(Date.now());
    const response = await fetch(new URL("/internal/dashboard", base), {
      method: "POST", cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", "x-request-id": String(input.request_id),
        "x-dashboard-timestamp": timestamp,
        "x-dashboard-signature": signDashboardRequest(process.env.CAPTURE_INTENT_ENCRYPTION_KEY ?? "", timestamp, body) },
      body, signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = errorEnvelopeSchema.safeParse(payload.error);
      throw new ScreenshotAPIError(error.success
        ? { code: error.data.code, message: error.data.message, requestId: error.data.request_id, details: error.data.details }
        : { code: "internal_error", message: "Capture service temporarily unavailable", requestId: String(input.request_id) });
    }
    return payload.data as JobSnapshot;
  };
  const service: Pick<CaptureService, "submit" | "lookup" | "lookupRequest"> = {
    submit: async (identity, input, requestId, _mode, key) => call({ operation: "submit", account_id: identity.accountId,
      request_id: requestId, options: typeof input === "function" ? await input() : input, key: key ?? requestId }),
    lookup: async (identity, jobId, requestId) => call({ operation: "lookup", account_id: identity.accountId, request_id: requestId, job_id: jobId }),
    lookupRequest: async (identity, key, requestId) => call({ operation: "request", account_id: identity.accountId, request_id: requestId, key }),
  };
  return { service, async health() {
    const response = await fetch(new URL("/v1/health", base), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    const payload = await response.json();
    const workers = payload.data?.ready_workers ?? 0;
    return { ok: response.ok && payload.ok === true, in_flight: payload.data?.queue?.active ?? 0,
      concurrency: workers * 4, concurrency_target: workers * 4, browser: null, pool: null, cache: null, ready_workers: workers };
  } };
}
