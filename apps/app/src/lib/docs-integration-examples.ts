export const HOSTED_CAPTURE_NODE = `import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const base = process.env.SCREENSHOTAPI_API_URL?.replace(/[/]$/, "");
const key = process.env.SCREENSHOTAPI_API_KEY;
if (!base || !key) throw new Error("Set SCREENSHOTAPI_API_URL and SCREENSHOTAPI_API_KEY");
const requestKey = process.env.CAPTURE_REQUEST_ID || randomUUID();
const signal = AbortSignal.timeout(180_000);
console.log("Request key:", requestKey);

function failure(payload, status) {
  return new Error(JSON.stringify({
    status, code: payload.error?.code, message: payload.error?.message,
    request_id: payload.request_id, details: payload.error?.details,
  }));
}

const response = await fetch(base + "/v1/screenshot", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "Idempotency-Key": requestKey,
  },
  body: JSON.stringify({
    url: process.argv[2] || "https://example.com",
    format: "png", full_page: true, fail_if_incomplete: true,
  }),
  signal,
});
const accepted = await response.json();
if (!response.ok || !accepted.ok) throw failure(accepted, response.status);
let result = accepted;
if (response.status === 202) {
  const jobId = accepted.data.job_id;
  console.log("Accepted job:", jobId);
  while (true) {
    await sleep(2000, undefined, { signal });
    const poll = await fetch(base + "/v1/jobs/" + encodeURIComponent(jobId), {
      headers: { Authorization: "Bearer " + key }, signal,
    });
    if (poll.status === 429 || poll.status === 503) {
      const seconds = Number(poll.headers.get("Retry-After")) || 3;
      await sleep(Math.min(30, Math.max(1, seconds)) * 1000, undefined, { signal });
      continue;
    }
    const job = await poll.json();
    if (!poll.ok || !job.ok) throw failure(job, poll.status);
    if (job.data.state === "failed") throw failure(job.data.result, poll.status);
    if (job.data.state === "completed") {
      result = job.data.result;
      break;
    }
  }
}
if (!result?.ok || !result.data?.cdn_url) throw new Error("Capture returned no artifact");
const artifact = await fetch(result.data.cdn_url, { signal });
if (!artifact.ok) throw new Error("Artifact download failed: HTTP " + artifact.status);
await writeFile("capture.png", Buffer.from(await artifact.arrayBuffer()));
console.log("Saved capture.png", result.data.width, "×", result.data.height);`;

export const HOSTED_CAPTURE_PYTHON = `import json
import os
import shutil
import sys
import time
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError

base = os.environ["SCREENSHOTAPI_API_URL"].rstrip("/")
key = os.environ["SCREENSHOTAPI_API_KEY"]
request_key = os.environ.get("CAPTURE_REQUEST_ID") or str(uuid.uuid4())
deadline = time.monotonic() + 180
print("Request key:", request_key)

def remaining():
    seconds = deadline - time.monotonic()
    if seconds <= 0:
        raise TimeoutError("Stopped waiting; use the saved job ID to resume polling")
    return seconds

def pause(seconds):
    time.sleep(min(seconds, remaining()))
    remaining()

def request(path, body=None):
    headers = {"Authorization": "Bearer " + key}
    data = None
    if body is not None:
        headers.update({"Content-Type": "application/json", "Idempotency-Key": request_key})
        data = json.dumps(body).encode()
    outgoing = Request(base + path, data=data, headers=headers,
                       method="POST" if body is not None else "GET")
    try:
        response = urlopen(outgoing, timeout=min(30, remaining()))
    except HTTPError as error:
        response = error
    with response:
        status, response_headers = response.status, response.headers
        payload = {} if status in (429, 503) else json.load(response)
    return status, payload, response_headers

def failure(status, payload):
    return RuntimeError(json.dumps({"status": status, "request_id": payload.get("request_id"),
                                   "error": payload.get("error")}))

status, result, headers = request("/v1/screenshot", {
    "url": sys.argv[1] if len(sys.argv) > 1 else "https://example.com",
    "format": "png", "full_page": True, "fail_if_incomplete": True,
})
if status not in (200, 202) or not result.get("ok"):
    raise failure(status, result)
if status == 202:
    job_id = result["data"]["job_id"]
    print("Accepted job:", job_id)
    while True:
        pause(2)
        status, job, headers = request("/v1/jobs/" + job_id)
        if status in (429, 503):
            try:
                delay = float(headers.get("Retry-After", "3"))
            except ValueError:
                delay = 3
            pause(min(30, max(1, delay)))
            continue
        if status != 200 or not job.get("ok"):
            raise failure(status, job)
        if job["data"]["state"] == "failed":
            raise failure(status, job["data"]["result"])
        if job["data"]["state"] == "completed":
            result = job["data"]["result"]
            break
if not result.get("ok") or not result.get("data", {}).get("cdn_url"):
    raise RuntimeError("Capture returned no artifact")
with urlopen(result["data"]["cdn_url"], timeout=min(30, remaining())) as artifact:
    with open("capture.png", "wb") as output:
        shutil.copyfileobj(artifact, output)
print("Saved capture.png")`;
