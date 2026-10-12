import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const base = "https://api.screenshotapi.tech";
const key = process.env.SCREENSHOTAPI_API_KEY;
if (!key) throw new Error("Set SCREENSHOTAPI_API_KEY");
const idempotencyKey = process.env.CAPTURE_IDEMPOTENCY_KEY || randomUUID();
console.log("Save this idempotency key for recovery:", idempotencyKey);
const deadline = Date.now() + 180_000;
const auth = { Authorization: "Bearer " + key };

function remaining() {
  const ms = deadline - Date.now();
  if (ms <= 0) throw new Error("Client deadline reached; recover the existing request by key");
  return ms;
}
async function pause(ms) {
  if (ms >= remaining()) throw new Error("Client deadline reached; recover the existing request by key");
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { ...auth, ...options.headers },
    signal: AbortSignal.timeout(Math.min(30_000, remaining())),
  });
  const body = await response.json();
  return { response, body };
}
function apiError(body, status) {
  return new Error(JSON.stringify({ status, error: body.error, request_id: body.request_id }));
}

const submitted = await api("/v1/screenshot", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
  body: JSON.stringify({ url: "https://example.com", format: "png", sync: false }),
});
if (!submitted.response.ok || !submitted.body.ok) {
  throw apiError(submitted.body, submitted.response.status);
}
let capture;
if (submitted.response.status === 200) {
  capture = submitted.body.data;
} else if (submitted.response.status === 202) {
  const jobId = submitted.body.data.job_id;
  console.log("Job:", jobId);
  const pollPath = "/v1/jobs/" + encodeURIComponent(jobId);
  let interval = 1000;
  while (!capture) {
    await pause(interval);
    const { response, body } = await api(pollPath);
    if (response.status === 429 && body.error?.code === "rate_limited") {
      const seconds = Number(response.headers.get("retry-after"));
      interval = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Math.min(interval * 2, 10000);
      interval += Math.floor(Math.random() * 250);
      continue;
    }
    if (!response.ok || !body.ok) throw apiError(body, response.status);
    if (body.data.state === "failed") throw apiError({ error: body.data.result?.error }, response.status);
    if (body.data.state === "completed") {
      if (!body.data.result?.ok) throw new Error("Completed job has no successful result");
      capture = body.data.result.data;
    }
    interval = Math.min(interval + 250, 3000);
  }
} else {
  throw new Error("Unexpected submission status: " + submitted.response.status);
}
if (!capture?.cdn_url) throw new Error("Capture has no artifact URL");
const artifact = await fetch(capture.cdn_url, {
  signal: AbortSignal.timeout(remaining()),
});
if (!artifact.ok) throw new Error("Artifact download failed: " + artifact.status);
await writeFile("capture.png", Buffer.from(await artifact.arrayBuffer()));
console.log("Saved capture.png", capture.width, capture.height, capture.bytes);
