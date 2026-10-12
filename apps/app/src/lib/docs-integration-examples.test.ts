import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { captureOptionsSchema } from "@screenshotapi/contracts";
import { HOSTED_CAPTURE_NODE, HOSTED_CAPTURE_PYTHON } from "./docs-integration-examples.js";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

test("the complete Node.js example saves sync and queued artifacts, backs off, and surfaces terminal failures", async () => {
  for (const outcome of ["sync", "queued", "failed", "unauthorized"]) {
    const waits: number[] = [];
    const files: { path: string; bytes: Buffer }[] = [];
    const data = { cdn_url: "https://artifacts.example/capture.png", width: 2560, height: 3000 };
    const polling = [new Response("busy", { status: 429, headers: { "Retry-After": "4" } }), new Response("unavailable", { status: 503 }),
      Response.json({ ok: true, data: { state: "active" } }),
      Response.json({ ok: true, data: { state: outcome === "failed" ? "failed" : "completed", result: outcome === "failed" ? { ok: false, error: { code: "render_incomplete", message: "Missing content" } } : { ok: true, data } } })];
    const fetch = async (url: string, init?: RequestInit) => {
      if (url === data.cdn_url) {
        assert.equal(init?.headers, undefined);
        return new Response("image-bytes");
      }
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer example-key");
      if (url.endsWith("/v1/screenshot")) {
        assert.equal(init?.method, "POST");
        assert.equal((init.headers as Record<string, string>)["Idempotency-Key"], "saved-request-key");
        assert.ok(captureOptionsSchema.safeParse(JSON.parse(String(init.body))).success);
        if (outcome === "unauthorized") return Response.json({ ok: false, request_id: "request-1", error: { code: "unauthorized", message: "Invalid key" } }, { status: 401 });
        return Response.json({ ok: true, data: outcome === "sync" ? data : { job_id: "job-1" } }, { status: outcome === "sync" ? 200 : 202 });
      }
      assert.equal(url, "https://gateway.example/v1/jobs/job-1");
      assert.ok(polling.length, "polling must stop at a terminal state");
      return polling.shift()!;
    };
    const code = HOSTED_CAPTURE_NODE.replace(/^import .+;\n/gm, "");
    const execute = new AsyncFunction("process", "fetch", "AbortSignal", "console", "randomUUID", "sleep", "writeFile", "Buffer", code);
    const run = () => execute({ env: { SCREENSHOTAPI_API_URL: "https://gateway.example/", SCREENSHOTAPI_API_KEY: "example-key", CAPTURE_REQUEST_ID: "saved-request-key" }, argv: ["node", "capture.mjs"] }, fetch, AbortSignal, { log: () => {} }, () => "unused", async (ms: number) => { waits.push(ms); }, async (path: string, bytes: Buffer) => { files.push({ path, bytes }); }, Buffer);
    if (["failed", "unauthorized"].includes(outcome)) {
      await assert.rejects(run, outcome === "failed" ? /render_incomplete/ : /unauthorized/);
      assert.equal(files.length, 0);
    } else {
      await run();
      assert.equal(files.length, 1);
      assert.equal(files[0].path, "capture.png");
      assert.equal(files[0].bytes.toString(), "image-bytes");
    }
    if (outcome === "queued" || outcome === "failed") {
      assert.ok(waits.includes(4000));
      assert.ok(waits.includes(3000));
      assert.equal(polling.length, 0);
    }
  }
});

test("the complete Python example saves hosted output and handles transient and terminal job responses", { skip: spawnSync("python", ["--version"]).status !== 0 }, () => {
  const harness = `import builtins, io, json, os, sys, time
import urllib.request
from urllib.error import HTTPError
code = json.load(sys.stdin)
os.environ.update(SCREENSHOTAPI_API_URL="https://gateway.example/", SCREENSHOTAPI_API_KEY="example-key", CAPTURE_REQUEST_ID="saved-request-key")
sys.argv = ["capture.py"]
time.sleep = lambda seconds: None
class Response(io.BytesIO):
    def __init__(self, body, status=200, headers=None):
        super().__init__(body)
        self.status, self.headers = status, headers or {}
for outcome in ["sync", "queued", "failed"]:
    files = []
    class Output(io.BytesIO):
        def close(self):
            files.append(self.getvalue())
            super().close()
    builtins.open = lambda path, mode: Output() if path == "capture.png" and mode == "wb" else None
    data = {"cdn_url": "https://artifacts.example/capture.png"}
    result = {"ok": False, "error": {"code": "render_incomplete"}} if outcome == "failed" else {"ok": True, "data": data}
    poll = [(429, {}, {"Retry-After": "4"}), (503, {}, {}),
            (200, {"ok": True, "data": {"state": "active"}}, {}),
            (200, {"ok": True, "data": {"state": "failed" if outcome == "failed" else "completed", "result": result}}, {})]
    def fetch(request, timeout):
        if isinstance(request, str):
            assert request == data["cdn_url"]
            return Response(b"image-bytes")
        assert request.get_header("Authorization") == "Bearer example-key"
        if request.method == "POST":
            assert request.full_url == "https://gateway.example/v1/screenshot"
            assert request.get_header("Idempotency-key") == "saved-request-key"
            assert json.loads(request.data)["full_page"] is True
            return Response(json.dumps({"ok": True, "data": data if outcome == "sync" else {"job_id": "job-1"}}).encode(), 200 if outcome == "sync" else 202)
        assert request.full_url == "https://gateway.example/v1/jobs/job-1"
        status, payload, headers = poll.pop(0)
        if status >= 400:
            raise HTTPError(request.full_url, status, "busy", headers, io.BytesIO(b"not JSON"))
        return Response(json.dumps(payload).encode(), status, headers)
    urllib.request.urlopen = fetch
    try:
        exec(code, {})
        assert outcome != "failed"
        assert files == [b"image-bytes"]
    except RuntimeError as error:
        assert outcome == "failed" and "render_incomplete" in str(error)
        assert files == []
    if outcome != "sync":
        assert poll == []`;
  const result = spawnSync("python", ["-c", harness], { input: JSON.stringify(HOSTED_CAPTURE_PYTHON), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
