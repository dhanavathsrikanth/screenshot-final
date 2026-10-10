import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { createR2Storage, MULTIPART_THRESHOLD_BYTES } from "./r2.js";

async function fixture(failPart = false) {
  const parts = new Map<number, Buffer>();
  let active = 0;
  let peak = 0;
  let aborted = false;
  let completed = false;
  let metadata: http.IncomingHttpHeaders = {};
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const body: Buffer[] = [];
    for await (const chunk of request) body.push(Buffer.from(chunk));
    response.setHeader("content-type", "application/xml");
    if (request.method === "POST" && url.searchParams.has("uploads")) {
      metadata = request.headers;
      response.end("<InitiateMultipartUploadResult><Bucket>test</Bucket><Key>capture.pdf</Key><UploadId>fixture-upload</UploadId></InitiateMultipartUploadResult>");
    } else if (request.method === "PUT" && url.searchParams.has("partNumber")) {
      active++;
      peak = Math.max(peak, active);
      await setTimeout(80);
      active--;
      const part = Number(url.searchParams.get("partNumber"));
      if (failPart && part === 2) {
        response.statusCode = 400;
        response.end("<Error><Code>InvalidRequest</Code><Message>Fixture part failure</Message></Error>");
      } else {
        parts.set(part, Buffer.concat(body));
        response.setHeader("etag", `"part-${part}"`);
        response.end();
      }
    } else if (request.method === "POST") {
      completed = true;
      response.end('<CompleteMultipartUploadResult><ETag>"complete-etag"</ETag></CompleteMultipartUploadResult>');
    } else if (request.method === "DELETE") {
      aborted = true;
      response.statusCode = 204;
      response.end();
    } else {
      response.statusCode = 400;
      response.end("unexpected request");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const storage = createR2Storage({
    bucket: "test", region: "us-east-1", endpoint: `http://127.0.0.1:${port}`,
    forcePathStyle: true, accessKeyId: "fixture", secretAccessKey: "fixture",
  });
  return {
    storage,
    state: () => ({ parts, peak, aborted, completed, metadata }),
    close: async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); },
  };
}

test("large uploads preserve every byte and metadata while sending bounded parallel parts", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const input = Buffer.alloc(MULTIPART_THRESHOLD_BYTES + 1024 * 1024);
  for (let i = 0; i < input.length; i++) input[i] = i % 251;
  const result = await f.storage.put("capture.pdf", input, "application/pdf", 120, { width: "1280" });
  const state = f.state();
  const reassembled = Buffer.concat([...state.parts].sort(([a], [b]) => a - b).map(([, body]) => body));
  const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");
  assert.equal(digest(reassembled), digest(input));
  assert.equal(state.parts.size, 3);
  assert.ok(state.peak >= 2 && state.peak <= 3);
  assert.equal(state.completed, true);
  assert.equal(state.aborted, false);
  assert.equal(state.metadata["content-type"], "application/pdf");
  assert.equal(state.metadata["x-amz-meta-width"], "1280");
  assert.equal(state.metadata["cache-control"], "public, max-age=120, must-revalidate");
  assert.equal(result.bytes, input.length);
  assert.equal(result.etag, '"complete-etag"');
});

test("a failed multipart upload aborts its unfinished object and never reports completion", async (t) => {
  const f = await fixture(true);
  t.after(f.close);
  await assert.rejects(f.storage.put("capture.pdf", Buffer.alloc(MULTIPART_THRESHOLD_BYTES + 1), "application/pdf"));
  assert.equal(f.state().aborted, true);
  assert.equal(f.state().completed, false);
});
