#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createEngine } from "@screenshotapi/engine";
import { createScreenshotAPIMcpServer } from "./index.js";

const concurrency = Number((process.env.SCREENSHOTAPI_MCP_CONCURRENCY ?? process.env.SNAPFORGE_MCP_CONCURRENCY) ?? 2);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) {
  throw new Error("SCREENSHOTAPI_MCP_CONCURRENCY must be an integer from 1 to 12");
}

const engine = createEngine({
  maxConcurrentCaptures: concurrency,
});
const server = createScreenshotAPIMcpServer(engine);
const transport = new StdioServerTransport();

await server.connect(transport);

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await Promise.allSettled([server.close(), engine.close()]);
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
