# Researched pricing implementation

The approved draft prices now live in one shared catalog: `packages/contracts/src/pricing.ts`. The application, billing product mapping, documentation, and database allowances derive their values from it.

| Plan | Monthly USD | Monthly credits | Status |
| --- | ---: | ---: | --- |
| Free | 0 | 50 | Available |
| Starter | 9 | 1,000 | Focus plan |
| Pro | 29 | 5,000 | Recommended focus plan |
| Growth | 79 | 15,000 | Focus plan |
| Scale | 199 | 40,000 | Planned; no self-service checkout |

Public `/pricing` includes audience-specific plan cards, a credit estimator, FAQs and signup links. `/billing` presents the same prices, remaining credits after reservations, prepaid packs and monthly reset rules. Both use the existing Hostinger tokens. The playground shows the capture cost on its button.

The public pricing page and signature-verified payment callback skip Clerk session middleware entirely. An expired development session had redirected even public pages to an unavailable Clerk DNS endpoint. A fresh browser visit now renders pricing successfully; protected workspace routes still require Clerk authentication.

Viewport images reserve 1 credit, full-page images 2, PDFs 3. Monthly credits are allocated first; a job can use the last monthly credit and prepaid credits together. Failed captures refund exactly those amounts. Atomic row locks prevent quota overspending. Duplicate finalization cannot charge or refund twice. Legacy reservations keep their original one-credit cost. Queue retries and idempotent HTTP retries reuse their original reservation.

Database migration `0006_researched_pricing.sql` adds Starter/Growth enum values and reservation allocation columns, and has been applied to the configured database. It does not rewrite historical reservations. Deployment must update API and app together so both use the same credit policy; the running production API has not been redeployed in this task.

New versioned payment product environment names prevent accidentally reusing the old large credit products. Checkout reads Dodo's product and rejects a price/currency/cadence mismatch and unpriced discounts/trials. Existing subscribers are directed to the portal rather than another subscription checkout. The Dodo callback endpoint is exempt from browser-session protection while retaining signature verification.

The provided Dodo test API key, test webhook signing key, six matching product IDs, and localhost billing return URL are now configured in ignored local environment files. Starter/Pro/Growth recurring products and all three prepaid packs were created and verified through Dodo. Twelve obsolete ScreenTool test products were archived, with a recoverable audit snapshot in `.qa/dodo-audit.json`. No active subscriptions were found in the old test catalog. Checkout now requires both API and webhook credentials, and the billing page clearly identifies sandbox mode.

The new test callback is registered at `https://screenshot-final.vercel.app/api/webhook` and remains disabled until deployment and domain routing are ready. The existing two old-app callbacks were not modified. Cloudflare and the public homepage show that `screenshotapi.tech` currently serves an older application with different pricing. Choosing whether the new console should replace the main domain or use `app.screenshotapi.tech` is pending user input; callback and deployed return URLs must follow that choice.

Signed local callback QA verified signature rejection, activation, plan changes, prepaid grants, duplicate payment handling, scheduled cancellation, and expiry, using a temporary account that was removed afterwards. Provider sandbox checkout sessions were created successfully for Starter, Pro, and Growth using a fictional QA customer. Starter's hosted checkout visibly shows $9/month and 1,000 credits. No payment was submitted. Real provider-to-deployed-app delivery and a complete payment/renewal/portal lifecycle remain launch gates. Test and live product IDs and keys are separate.

Verification: two catalog/allocation tests; seven real PostgreSQL accounting tests using temporary accounts with cleanup; 45 queue/service/submission/idempotency tests; 29 dashboard capture tests; 13 API gateway tests; three checkout price-policy tests. Contract, queue, database, API and application TypeScript checks pass. The API compiler now includes standard DOM Web API types required by its Hono Request/Response tests. Public pricing was checked at desktop and 390px mobile width, including estimator changes. No capture-quality settings were altered.

The standalone Redis billing adapter also supports weighted holds. Its live Redis QA script is `.qa/redis-pricing-check.mjs`; it could not run because this local environment has no Redis TCP URL. The configured paid account path uses the PostgreSQL repository, which was verified.

Profit target remains the research model's roughly 65–68% contribution margin at base assumed costs, not guaranteed net profit. Provider invoices, artifact transfer, retries, support, acquisition and salaries can change it. Artifact delivery through Vercel, verified object deletion, fleet capacity, and actual monthly cost measurements remain prerequisites for expanding allowances or making margin/latency guarantees. Future paid features and long-term storage are not silently bundled into these plans.
