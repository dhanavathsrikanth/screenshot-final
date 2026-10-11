import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createEngine } from "./engine.js";
import { SnapforgeError } from "@snapforge/contracts";

test("the request deadline cancels a stalled page and does not restart the rendering budget", { timeout: 20_000 }, async (t) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.write("<!doctype html><html><head><title>Unfinished response</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const engine = createEngine({ stealth: false, retries: 1, maxConcurrentCaptures: 1, autoConcurrency: false });
  t.after(async () => { await engine.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  await engine.warm();
  const start = Date.now();
  await assert.rejects(engine.capture({
    url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, timeout: 1000,
    cache_ttl: 0, full_page: true,
  }), (error: unknown) => error instanceof SnapforgeError && error.code === "render_timeout" && !error.retriable);
  assert.ok(Date.now() - start < 4000, "one-second deadline must not turn into repeated render attempts");
  const health = await engine.health();
  assert.equal(health.in_flight, 0);
  assert.equal(health.pool.busy, 0);
});
