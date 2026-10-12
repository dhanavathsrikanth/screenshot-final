# Documentation guidance

This directory uses Mintlify's default `mint` theme and starter colors, as explicitly requested by the user. Do not apply the Hostinger palette or custom dashboard styling here.

Write new developer documentation from implementation evidence. Do not copy the dashboard docs or internal engineering notes. Use ScreenshotAPI consistently as the product name. Explain the task, show a valid request, explain the response, and link to the next step.

Verify behavior against `apps/api/src/gateway.ts`, `packages/contracts/src`, `packages/queue/src`, and `packages/mcp/src`. Do not present roadmap items, deployment assumptions, SDK publication, latency targets, or managed proxy availability as shipped capabilities.

After changing contracts, build contracts and regenerate the reference with `pnpm --filter @screenshotapi/docs run generate`. Validate with `mint validate` and `mint broken-links` from this directory. Keep deployment instructions in README.md, excluded from publishing.
