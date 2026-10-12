# ScreenshotAPI developer documentation

This is a newly written Mintlify site. It uses the default `mint` layout and the official starter colors. Product identity comes from consistent ScreenshotAPI naming and precise developer guidance. It does not import Hostinger tokens, custom dashboard CSS, or the existing documentation content.

## Preview and validate

From the repository root:

```bash
pnpm --filter @screenshotapi/contracts run build
pnpm --filter @screenshotapi/docs run generate
pnpm --filter @screenshotapi/docs run check
pnpm --filter @screenshotapi/docs run validate
pnpm --filter @screenshotapi/docs run links
pnpm --filter @screenshotapi/docs run dev
```

The CLI scripts use `pnpm dlx mint@4.2.1006`, so the first run needs network access. Run them on Node.js supported by that CLI. The generated OpenAPI file is committed so Mintlify's hosted deployment does not need to build the monorepo. Rebuild contracts before regenerating; generation imports compiled contracts.

`check` verifies local navigation, links, OpenAPI references, schema drift, JSON examples, and language-guide/example consistency. Mintlify validation checks MDX and the full OpenAPI document. Validation does not prove the deployed screenshot service is healthy.

## Content architecture

- Start building: product overview, first capture, credentials, and response semantics.
- Capture controls: viewport/device sizing, full-page algorithms, image/PDF differences, readiness checks, DOM controls, and localization.
- Reliable integration: asynchronous jobs, idempotent recovery, signed webhooks, credits/caching/limits, and executable Node.js/Python examples.
- AI agents: the private local stdio MCP implementation and its actual tools.
- Contract reference: generated device presets, errors, and the six public route paths with seven operations, plus outbound webhook payloads.

The public content intentionally avoids unverified production latency claims, unpublished SDK install commands, guaranteed bot bypass, and managed proxy promises. API host, plan availability, purchased limits, and artifact retention must be confirmed against the deployment.

## Source of truth

| Content | Implementation evidence |
| --- | --- |
| HTTP routes, scopes, headers, statuses | `apps/api/src/gateway.ts` |
| Capture inputs, defaults, types, ranges | `packages/contracts/src/options.ts`, `request.ts` |
| Output, diagnostics, errors | `packages/contracts/src/envelope.ts`, `errors.ts` |
| Device presets and regions | `packages/contracts/src/presets.ts`, `regions.ts` |
| Credit cost | `packages/contracts/src/pricing.ts` |
| Admission, cache behavior, durable requests | `packages/queue/src/service.ts`, `idempotency.ts` |
| Job snapshots | `packages/queue/src/types.ts`, `outcome.ts` |
| Webhook signatures, payload, delivery | `packages/queue/src/webhook.ts`, `webhook-outbox.ts` |
| PDF paths and viewport precedence | `packages/engine/src/formats.ts`, `tiles.ts`, `context.ts` |
| MCP transport, tools, package availability | `packages/mcp/src/main.ts`, `index.ts`, `package.json` |

Contract refinement rules that cannot be represented automatically, such as public destination policies and HTTPS webhook constraints, are described in prose. Review gateway changes against the manually described operation behavior. Never convert a roadmap checkbox into a capability claim without checking its code and deployment status.

The language samples in `examples/` are executable source; their guides display the same source. Update both when changing a sample, and run `check`. Replace development placeholders with account/deployment values when running samples, but never commit secrets.

## Publish on a subdomain

Proposed documentation address: `docs.screenshotapi.tech`. This is a deployment target, not a claim that DNS or hosting is already configured.

1. Create or select the ScreenshotAPI project in Mintlify and connect the GitHub repository containing this site. Grant the GitHub app access to that repository.
2. Choose the intended production branch. In Git Settings, enable the subdirectory setting and set the documentation path to `/apps/docs`, with no trailing slash.
3. Review the initial Mintlify preview: navigation, API reference, code blocks, mobile layout, and both light/dark appearances.
4. The guides, executable examples, and generated OpenAPI spec use `https://api.screenshotapi.tech`. If the public API origin changes, update the generator and all examples together, regenerate `openapi.json`, and run the content check. No URL is read from the repository's secret environment files.
5. Before enabling the interactive API playground, verify browser/proxy behavior against the actual API, CORS as applicable, credential handling, and rate limits. The current `simple` playground configuration displays request documentation without presenting an unverified Try It flow.
6. In Mintlify's custom-domain settings, add `docs.screenshotapi.tech` (or the final chosen subdomain). Add exactly the DNS records shown there to the authoritative DNS provider. If using Cloudflare DNS, follow Mintlify's current proxy instructions during verification.
7. Wait for domain verification and automatic TLS provisioning. Check HTTPS and representative pages on the custom domain.
8. Once live, update website/dashboard links and redirect each legacy documentation URL to the corresponding new page. Keep current links active until the new domain is verified.

No Mintlify account, GitHub app installation, DNS record, production link, or legacy documentation route is changed by adding this directory.

Official setup references:

- [Monorepo deployment](https://www.mintlify.com/docs/deploy/monorepo)
- [Custom domains and TLS](https://www.mintlify.com/docs/customize/custom-domain)
- [CLI validation](https://www.mintlify.com/docs/cli/commands)
- [OpenAPI configuration](https://www.mintlify.com/docs/api-playground/openapi-setup)

## Maintenance

Review documentation in the same change as API behavior. Rebuild and regenerate after contract changes, then run content and Mintlify validation. Exercise example workflows against an isolated API before a release, including direct completion, accepted job polling, terminal failure, uncertain submissions, and webhook verification. Keep prices and capacity promises in the deployment's confirmed commercial source rather than duplicating an unverified catalog here.

## Verification on 2026-10-12

- Contracts TypeScript build passed before reference generation.
- Content check passed: 20 pages, 19 JSON examples, navigation, internal links, schema defaults, OpenAPI references, and exact language sample consistency.
- Mintlify CLI 4.2.1006 strict build validation passed, including OpenAPI processing.
- Mintlify broken-link check passed.
- Node.js and Python executable samples each passed local fixtures for direct completion, asynchronous polling with a temporary unknown state, 429 backoff, and terminal capture failure. The fixtures also checked job-ID encoding and that API credentials were not forwarded to the artifact host.
- The documented webhook verifier accepted a valid signature and rejected tampered bodies, stale/future timestamps, wrong secrets, and malformed headers.
- The local preview rendered the overview, responsive navigation, and generated capture endpoint. Local search requires Mintlify login; the preview runtime reported a native minifier fallback and served unminified content successfully.

These are local documentation and fixture checks, not a production API, billing, domain, or webhook delivery verification.
