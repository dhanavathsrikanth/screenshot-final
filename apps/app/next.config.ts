import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

loadEnv({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveAlias: { "./capture-artifact.js": "./src/lib/capture-artifact.ts" },
  },
  transpilePackages: ["@snapforge/contracts", "@snapforge/brand", "@snapforge/database"],
  serverExternalPackages: [
    "@snapforge/engine",
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
};

export default nextConfig;
