import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

loadEnv({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  async redirects() {
    const pages: Record<string, string> = {
      "": "",
      quickstart: "quickstart",
      integrations: "integration/node",
      authentication: "authentication",
      "api/screenshot": "api-reference/captures/create-a-capture",
      "api/options": "api-reference/captures/create-a-capture",
      "api/jobs": "integration/async-jobs",
      "api/retries": "integration/idempotency",
      "api/webhooks": "integration/webhooks",
      "api/health": "api-reference/service/check-service-readiness",
      "guides/full-page": "capture/full-page",
      "guides/devices": "capture/viewport",
      "guides/formats": "capture/formats",
      "guides/waiting": "capture/readiness",
      "guides/quality": "capture/readiness",
      "guides/customization": "capture/page-controls",
      "guides/caching": "integration/credits-and-limits",
      "guides/regions": "capture/localization",
      errors: "errors",
      billing: "integration/credits-and-limits",
      mcp: "agents/mcp",
    };
    return [
      ...Object.entries(pages).flatMap(([source, destination]) => [
        { source: `/docs${source ? `/${source}` : ""}`, destination: `https://docs.screenshotapi.tech/${destination}`, permanent: false },
        { source: `/docs/markdown${source ? `/${source}` : ""}`, destination: `https://docs.screenshotapi.tech/${destination ? `${destination}.md` : "index.md"}`, permanent: false },
      ]),
      { source: "/llms.txt", destination: "https://docs.screenshotapi.tech/llms.txt", permanent: false },
    ];
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveAlias: {
      "./capture-artifact.js": "./src/lib/capture-artifact.ts",
      "./docs-integration-examples.js": "./src/lib/docs-integration-examples.ts",
    },
  },
  transpilePackages: ["@screenshotapi/contracts", "@screenshotapi/brand", "@screenshotapi/database"],
  serverExternalPackages: [
    "@screenshotapi/engine",
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
};

export default nextConfig;
