import test from "node:test";
import assert from "node:assert/strict";
import { captureOptionsSchema } from "@screenshotapi/contracts";
import type { ScreenshotAPIEngine } from "@screenshotapi/engine";
import type { CaptureStore } from "@screenshotapi/storage";
import { createWorkerExecutor } from "./executor.js";

test("inspection survives hosted execution and is bounded without a second render", async () => {
  let renders = 0;
  const data = { url: "https://example.com", final_url: "https://example.com", format: "webp", width: 1280,
    height: 720, bytes: 12, duration_ms: 50, cached: false, blocked_requests: 0 };
  const executor = createWorkerExecutor({
    engine: { capture: async (_: unknown, mode: { inspectPage?: boolean }) => {
      renders++;
      assert.equal(mode?.inspectPage, true);
      return { data, buffer: Buffer.from("fixture"), inspection: { markdown: "m".repeat(15000), accessibleTree: "tree" } };
    } } as unknown as ScreenshotAPIEngine,
    store: { save: async () => ({ ...data, cdn_url: "https://cdn.example.com/image.webp" }) } as unknown as CaptureStore,
  });
  const result = await executor(captureOptionsSchema.parse({ url: data.url, inspect_page: true }), {
    workerId: "worker", attempt: 1, signal: new AbortController().signal, updateProgress: async () => {},
  });
  assert.equal(renders, 1);
  assert.equal(result.data.inspection?.markdown.length, 12000);
  assert.equal(result.data.inspection?.accessible_tree, "tree");
  assert.equal(result.data.inspection?.untrusted_content, true);
});
