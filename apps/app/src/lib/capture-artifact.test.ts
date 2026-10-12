import test from "node:test";
import assert from "node:assert/strict";
import { captureArtifactPath, captureArtifactJobId, captureObjectKey, createCaptureArtifactHandler } from "./capture-artifact.js";
import type { JobSnapshot } from "@screenshotapi/queue";

const config = { bucket: "private", endpoint: "https://storage.example", region: "iad", accessKeyId: "test", secretAccessKey: "test" };
const key = `captures/ab/cd/${"abcd" + "0".repeat(60)}.pdf`;
const id = "b2648705-baf0-4bf1-b6c1-556e79adc44d";
const token = captureArtifactPath(id).slice(3);
const snapshot = { id, state: "completed", result: { ok: true, data: { cdn_url: `https://private.storage.example/${key}?expired=1`, format: "pdf" } } } as JobSnapshot;

test("compact capture links round trip UUID and idempotent jobs without a database migration", () => {
  for (const job of [id, `idem-${"ab".repeat(32)}`, "job-test"]) assert.equal(captureArtifactJobId(captureArtifactPath(job).slice(3)), job);
  assert.equal(captureArtifactPath(id).length, 26);
  for (const invalid of ["u123", "i123", "!bad", token + "=", "u" + "a".repeat(300)]) assert.equal(captureArtifactJobId(invalid), null);
});

test("artifact keys must belong to configured storage with the expected capture layout", () => {
  assert.equal(captureObjectKey(snapshot.result!.data!.cdn_url!, config), key);
  assert.equal(captureObjectKey(`https://storage.example/private/${key}`, config), key);
  assert.equal(captureObjectKey(`https://attacker.example/${key}`, config), null);
  assert.equal(captureObjectKey("https://private.storage.example/other.pdf", config), null);
});

test("PDF delivery authenticates ownership, renews the signature, streams bytes and supports ranges", async () => {
  const handle = createCaptureArtifactHandler({ authenticate: async () => "owner",
    lookup: async (account, job) => { assert.equal(account, "owner"); assert.equal(job, id); return snapshot; },
    storage: () => ({ config, client: { urlFor: async (objectKey) => { assert.equal(objectKey, key); return "https://storage.example/fresh-signature"; } } }),
    fetch: async (url, init) => {
      assert.equal(url, "https://storage.example/fresh-signature"); assert.equal(new Headers(init?.headers).get("range"), "bytes=0-3");
      return new Response("%PDF", { status: 206, headers: { "content-range": "bytes 0-3/100", "accept-ranges": "bytes", "content-length": "4" } });
    },
  });
  const response = await handle(new Request("https://custom.example/c/test", { headers: { range: "bytes=0-3" } }), token);
  assert.equal(response.status, 206); assert.equal(await response.text(), "%PDF");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), 'inline; filename="capture.pdf"');
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("content-range"), "bytes 0-3/100");
});

for (const authenticated of [false, true]) test(`capture delivery denies ${authenticated ? "another account" : "anonymous visitors"} before storage access`, async () => {
  const handle = createCaptureArtifactHandler({ authenticate: async () => authenticated ? "other" : null,
    lookup: async () => { throw new Error("not owned"); }, storage: () => { throw new Error("must not reach storage"); },
  });
  assert.equal((await handle(new Request("https://app.test/c/test"), token)).status, authenticated ? 404 : 401);
});

test("download action serves an attachment and storage errors do not disclose signing details", async () => {
  let upstreamStatus = 200;
  const handle = createCaptureArtifactHandler({ authenticate: async () => "owner", lookup: async () => snapshot,
    storage: () => ({ config, client: { urlFor: async () => "https://storage.example/private-signature" } }),
    fetch: async () => new Response("%PDF", { status: upstreamStatus }),
  });
  const download = await handle(new Request("https://custom.example/c/test?download=1"), token);
  assert.equal(download.headers.get("content-disposition"), 'attachment; filename="capture.pdf"');
  upstreamStatus = 403;
  const unavailable = await handle(new Request("https://custom.example/c/test"), token);
  assert.equal(unavailable.status, 502);
  assert.doesNotMatch(await unavailable.text(), /private-signature/);
});

test("retained previews bypass queue finalization only after authentication and an owned lookup", async () => {
  let account: string | null = "owner";
  let storedReads = 0;
  let fallbackReads = 0;
  const handle = createCaptureArtifactHandler({
    authenticate: async () => account,
    storedCapture: async (owner, job) => { storedReads++; assert.equal(job, id); return owner === "owner" ? snapshot : null; },
    lookup: async () => { fallbackReads++; throw new Error("not owned"); },
    storage: () => ({ config, client: { urlFor: async () => "https://storage.example/fresh" } }),
    fetch: async () => new Response("%PDF"),
  });
  assert.equal((await handle(new Request("https://app.test/c/test"), token)).status, 200);
  assert.equal(storedReads, 1);
  assert.equal(fallbackReads, 0);
  account = "other";
  assert.equal((await handle(new Request("https://app.test/c/test"), token)).status, 404);
  assert.equal(fallbackReads, 1);
  account = null;
  assert.equal((await handle(new Request("https://app.test/c/test"), token)).status, 401);
  assert.equal(storedReads, 2);
});

test("an unsatisfiable PDF range preserves the storage size without exposing its body", async () => {
  const handle = createCaptureArtifactHandler({ authenticate: async () => "owner", lookup: async () => snapshot,
    storage: () => ({ config, client: { urlFor: async () => "https://storage.example/fresh" } }),
    fetch: async () => new Response("private upstream diagnostic", { status: 416, headers: { "content-range": "bytes */100" } }),
  });
  const response = await handle(new Request("https://app.test/c/test"), token);
  assert.equal(response.status, 416); assert.equal(response.headers.get("content-range"), "bytes */100"); assert.equal(await response.text(), "");
});
