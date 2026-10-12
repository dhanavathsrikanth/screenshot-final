import { DOC_PAGES } from "@/lib/docs-content";

export function GET() {
  const lines = [
    "# ScreenshotAPI",
    "",
    "> A browser capture API for screenshots, PDFs, and AI agents. This index links to the developer documentation and its Markdown equivalents. On app.screenshotapi.tech, documentation requires a signed-in console session. Export Markdown from an authenticated browser for agents without that session.",
    "",
    "## Integration essentials",
    "",
    "- Hosted API base URL: https://capture-api-production-4e2d.up.railway.app. Set SCREENSHOTAPI_API_URL to this address. No renderer installation is required.",
    "- REST requests use Authorization: Bearer $SCREENSHOTAPI_API_KEY. Create captures with POST /v1/screenshot.",
    "- Always support HTTP 202 job polling, even with sync: true. Poll GET /v1/jobs/{id}.",
    "- Completed data.url is the source page; data.cdn_url is the artifact download URL.",
    "- Use Idempotency-Key to recover uncertain requests. Keep the same request and webhook configuration when replaying a key.",
    "- Failed captures release reserved credits. Successful captures, including cache hits, consume credits.",
    "- cache_ttl controls acceptable reuse age, not artifact retention or download-link expiry.",
    "- Region presets require your own matching proxy for regional egress. Capture destinations must resolve to public networks.",
    "- AI agents use the authenticated hosted REST API from their backend. A hosted MCP endpoint is not currently available.",
    "- Copy complete Node.js and Python capture, polling, and artifact-download examples from /docs/markdown/integrations.",
    "",
  ];
  for (const group of [...new Set(DOC_PAGES.map((page) => page.group))]) {
    lines.push(`## ${group}`, "");
    for (const page of DOC_PAGES.filter((entry) => entry.group === group)) {
      lines.push(`- [${page.title}](/docs/markdown/${page.slug}): ${page.description}`);
    }
    lines.push("");
  }
  lines.push("## Human-readable documentation", "", "- [Documentation home](/docs)", "- [Capture playground](/playground)", "");
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
