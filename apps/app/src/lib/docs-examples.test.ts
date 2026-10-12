import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { captureOptionsSchema } from "@screenshotapi/contracts";
import { CAPTURE_CODE, DOC_PAGES, getDoc } from "./docs-content.js";
import { buildCurl, buildPython, buildTypeScript, DEFAULT_STATE } from "./playground.js";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
const environment = { env: { SCREENSHOTAPI_API_URL: "https://gateway.example", SCREENSHOTAPI_API_KEY: "example-key" } };
const options = { ...DEFAULT_STATE, fullPage: true, customJs: "document.title = 'Capture';" };

test("copied JavaScript capture examples execute against completed, queued, and rejected responses", async () => {
  for (const code of [CAPTURE_CODE.find((sample) => sample.label === "Node.js")!.code, buildTypeScript(options)]) {
    for (const status of [200, 202, 403]) {
      const outputs: unknown[] = [];
      const fetch = async (url: string, init: RequestInit) => {
        assert.equal(url, "https://gateway.example/v1/screenshot");
        assert.equal(init.method, "POST");
        assert.ok(captureOptionsSchema.safeParse(JSON.parse(String(init.body))).success);
        assert.equal((init.headers as Record<string, string>).Authorization, "Bearer example-key");
        return Response.json(status === 403 ? { ok: false, error: { message: "Permission denied" } } : { ok: true, data: status === 202 ? { poll_url: "/v1/jobs/job-1" } : { cdn_url: "https://artifacts.example/image.png" } }, { status });
      };
      const execute = new AsyncFunction("fetch", "process", "console", code);
      if (status === 403) await assert.rejects(() => execute(fetch, environment, { log: (...args: unknown[]) => outputs.push(args) }), /Permission denied/);
      else {
        await execute(fetch, environment, { log: (...args: unknown[]) => outputs.push(args) });
        assert.match(JSON.stringify(outputs), status === 202 ? /\/v1\/jobs\/job-1/ : /artifacts.example\/image.png/);
      }
    }
  }
});

test("the documented polling example handles throttling, unavailable workers, and terminal outcomes", async () => {
  const code = getDoc("api/jobs")!.sections.find((section) => section.id === "poll")!.code![0].code;
  for (const success of [true, false]) {
    const responses = [new Response(null, { status: 429 }), new Response(null, { status: 503 }),
      Response.json({ ok: true, data: { state: "active" } }),
      Response.json({ ok: true, data: { state: success ? "completed" : "failed", result: success ? { ok: true, data: { cdn_url: "https://artifacts.example/image.png" } } : { ok: false, error: { message: "Capture failed" } } } })];
    const execute = new AsyncFunction("fetch", "process", "console", "AbortSignal", "setTimeout", code);
    const run = () => execute(async (url: string) => {
      assert.equal(url, "https://gateway.example/v1/jobs/job_example");
      assert.ok(responses.length);
      return responses.shift();
    }, environment, { log: () => {} }, AbortSignal, (callback: () => void) => callback());
    if (success) await run(); else await assert.rejects(run, /Capture failed/);
    assert.equal(responses.length, 0);
  }
});

test("the copied webhook verification helper rejects tampering, expiry, and wrong secrets", async () => {
  const code = getDoc("api/webhooks")!.sections.find((section) => section.id === "verify-signature")!.code![0].code;
  const execute = new AsyncFunction("createHmac", "timingSafeEqual", "Buffer", code.replace(/import[^;]+;/, "").replace("export function", "function") + "\nreturn verifyWebhook;");
  const verify = await execute(createHmac, timingSafeEqual, Buffer) as (body: string, signature: string, secret: string) => boolean;
  const body = JSON.stringify({ event: "capture.completed", delivery_id: "delivery-1", delivery_generation: 0 });
  const secret = "example-secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = (time: number) => `t=${time},v1=${createHmac("sha256", secret).update(`${time}.${body}`).digest("hex")}`;
  assert.equal(verify(body, signature(timestamp), secret), true);
  assert.equal(verify(body + " ", signature(timestamp), secret), false);
  assert.equal(verify(body, signature(timestamp), "wrong-secret"), false);
  assert.equal(verify(body, signature(timestamp - 301), secret), false);
  assert.equal(verify(body, "invalid", secret), false);
});

test("all capture input examples satisfy the actual request schema", () => {
  for (const page of DOC_PAGES) for (const section of page.sections) for (const sample of section.code ?? []) {
    if (sample.language !== "json") continue;
    const input = JSON.parse(sample.code) as Record<string, unknown>;
    if (typeof input.url === "string" && !input.event && !input.ok) assert.ok(captureOptionsSchema.safeParse(input).success, `${page.slug}/${section.id}`);
  }
  assert.doesNotMatch(buildCurl(options), /curl -G/);
  assert.match(buildCurl(options), /'\\''Capture'\\''/);
});

test("copied Python examples execute with queued and completed responses without third-party packages", { skip: spawnSync("python", ["--version"]).status !== 0 }, () => {
  const script = `import io, json, os, sys
import urllib.request
os.environ.update(SCREENSHOTAPI_API_URL="https://gateway.example", SCREENSHOTAPI_API_KEY="example-key")
class Response(io.BytesIO):
    pass
for code in json.load(sys.stdin):
    for status, field in [(200, "cdn_url"), (202, "poll_url")]:
        response = Response(json.dumps({"ok": True, "data": {field: "expected-result"}}).encode())
        response.status = status
        def fetch(request, timeout):
            assert request.full_url == "https://gateway.example/v1/screenshot"
            assert request.method == "POST"
            assert json.loads(request.data)["url"] == "https://example.com"
            assert request.get_header("Authorization") == "Bearer example-key"
            return response
        output = io.StringIO()
        original = sys.stdout
        urllib.request.urlopen = fetch
        try:
            sys.stdout = output
            exec(code, {})
        finally:
            sys.stdout = original
        assert "expected-result" in output.getvalue()
print("Python capture examples passed")`;
  const result = spawnSync("python", ["-c", script], { input: JSON.stringify([CAPTURE_CODE.find((sample) => sample.label === "Python")!.code, buildPython(options)]), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
