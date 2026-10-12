import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { LAUNCH_PLANS, PLAN_CATALOG } from "@screenshotapi/contracts";

const output = new URL("./dist/", import.meta.url);
await mkdir(output, { recursive: true });
const plans = LAUNCH_PLANS.map((key) => {
  const plan = PLAN_CATALOG[key];
  return `<article class="plan ${key === "pro" ? "recommended" : ""}">
    <div class="plan-label">${key === "pro" ? "Recommended for developers" : plan.audience}</div>
    <h3>${plan.name}</h3><p class="price">$${plan.priceUsd}<span> / month</span></p>
    <p class="allowance">${plan.credits.toLocaleString("en-US")} monthly credits</p>
    <p class="plan-description">${plan.description}</p>
    <ul><li>PNG, JPEG, WebP &amp; PDF</li><li>Full-page and device captures</li><li>Playground &amp; API access</li><li>Capture history &amp; private previews</li></ul>
    <a class="${key === "pro" ? "primary" : "secondary"}" href="https://app.screenshotapi.tech/billing?plan=${key}">Explore ${plan.name} <span aria-hidden="true">↗</span></a>
  </article>`;
}).join("\n");
const template = await readFile(new URL("./index.html", import.meta.url), "utf8");
await writeFile(new URL("index.html", output), template.replace("{{plans}}", plans).replaceAll("{{freeCredits}}", String(PLAN_CATALOG.free.credits)));
await copyFile(new URL("./styles.css", import.meta.url), new URL("styles.css", output));
await copyFile(new URL("../../packages/brand/src/tokens.css", import.meta.url), new URL("tokens.css", output));
const tokens = await readFile(new URL("../../packages/brand/src/tokens.css", import.meta.url), "utf8");
const primary = tokens.match(/--sf-color-primary-600:\s*([^;]+);/)[1];
const foreground = tokens.match(/--sf-color-neutral-0:\s*([^;]+);/)[1];
await writeFile(new URL("favicon.svg", output), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${primary}"/><path d="M9 13V9h4m6 0h4v4m0 6v4h-4m-6 0H9v-4M16 12v8m-4-4h8" fill="none" stroke="${foreground}" stroke-width="2" stroke-linecap="round"/></svg>`);
await copyFile(new URL("../app/src/app/fonts/GeistSans.woff2", import.meta.url), new URL("GeistSans.woff2", output));
await copyFile(new URL("../app/src/app/fonts/GeistMono.woff2", import.meta.url), new URL("GeistMono.woff2", output));
await writeFile(new URL("robots.txt", output), "User-agent: *\nAllow: /\nSitemap: https://screenshotapi.tech/sitemap.xml\n");
await writeFile(new URL("sitemap.xml", output), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://screenshotapi.tech/</loc></url></urlset>');
console.log("Landing page built from the shared pricing catalog and brand tokens.");
