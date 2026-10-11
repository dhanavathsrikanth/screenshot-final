# Snapforge pricing research and provisional launch proposal

Research date: 11 October 2026. Currency: USD, before customer taxes. Status: proposal; no live billing or hosting changes made.

## Recommendation

Keep Vercel for the application and Railway for the capture API and Chromium workers. Improve delivery and metering before increasing volume. Offer the same capture quality on every plan, and charge credits according to the work performed. Do not launch the present 100,000-capture allowance at $199 without measuring its workload and costs.

| Proposed plan | Monthly price | Included credits | Price per 1,000 credits |
| --- | ---: | ---: | ---: |
| Free | $0 | 50 | — |
| Starter | $9 | 1,000 | $9.00 |
| Pro | $29 | 5,000 | $5.80 |
| Growth | $79 | 15,000 | $5.27 |
| Scale | $199 | 40,000 | $4.98 |

Provisional metering: ordinary viewport image = 1 credit; ordinary full-page image = 2; ordinary PDF = 3. Thus Pro permits 5,000 viewport images, 2,500 full-page images, or 1,666 PDFs, or a mixture. These are proposed allowances, not the current implementation. Validate weights against measured cost before checkout goes live.

Define and display the ordinary size/runtime envelope before purchase. Existing large, high-resolution pages must remain complete: charge a disclosed additional credit class for exceptionally long, slow, or large jobs, rather than truncating pages or reducing quality. Reserve an agreed maximum and refund unused credits; never make unapproved post-capture charges. Release all reserved credits for failed jobs. Set a spending cap for top-ups.

Provisional top-ups: $12/1,000 credits; $49/5,000; $179/20,000. Their higher unit price preserves subscription value and covers payment overhead. Avoid unlimited captures, unlimited retries, lifetime discounted credits, and lifetime access to every future costly feature. Start with monthly subscriptions; consider at most 10% annual discount after margins are verified.

## 1. What this project actually runs

| Component | Current implementation | Hosting / cost driver |
| --- | --- | --- |
| Dashboard and playground | Next.js 16, React 19, TypeScript, Tailwind 4, brand tokens | Vercel requests, functions, delivery |
| Application backend | Capture submission/polling, auth, account billing, Dodo webhook, private capture links | Also runs on Vercel; this is not a static-only frontend |
| Capture API | Hono, Node 22, Drizzle and PostgreSQL client | Railway service CPU, memory, networking |
| Capture worker | Playwright 1.63, Chromium, stealth integration, Sharp, pdf-lib | Railway worker CPU, memory, execution time, retries |
| Queue | BullMQ and ioredis over TLS/TCP | Upstash commands, memory, bandwidth |
| Account data | Neon PostgreSQL | Compute hours, storage, history, network |
| Captured files | Private S3-compatible Railway bucket | Stored bytes and worker upload egress |
| Authentication | Clerk | Retained users and optional paid capabilities |
| Billing | Dodo Payments integration | Transaction fees, refunds, disputes, payout channel |
| PDF preview | PDF.js | Artifact delivery and browser rendering |
| MCP | Local stdio package | No hosted model inference charge in current capture workflow |

The storage helper's R2-oriented name does not mean the deployed bucket is Cloudflare R2. The existing deployment uses a Railway bucket. No infrastructure migration is required merely to introduce pricing.

## 2. Published infrastructure prices

These are list prices, not verified invoices or confirmation of the account's subscribed plans.

| Provider | Relevant published rate | Planning implication |
| --- | --- | --- |
| Railway containers | RAM $10/GB-month; CPU $20/vCPU-month; service egress $0.05/GB | Measure resource use, including warm idle workers |
| Railway plans | Hobby $5, Pro $20, each including that amount of usage | Bill is the plan minimum plus usage above included credit; do not count both full fee and full usage |
| Railway bucket | $0.015/GB-month; bucket operations and egress free | Worker uploads over public networking can still incur service egress |
| Vercel Pro | $20/month, one deploy seat and $20 infrastructure usage credit | Budget a commercial plan; account plan is unverified |
| Vercel functions, IAD | $0.128/active CPU-hour; $0.0106/GB-hour memory; $0.60/million invocations | Waiting on storage still occupies memory; shared-instance concurrency affects the calculation |
| Upstash Redis | PAYG $0.20/100,000 commands; fixed 250MB $10/month; fixed 1GB $20/month | BullMQ can generate commands while idle |
| Neon Launch | $0.106/CU-hour; PostgreSQL storage $0.35/GB-month | An always-active 0.25 CU costs about $19.35 over 730 hours, before storage/history |
| Clerk | Free allowance of 50,000 monthly retained users; Pro $20/month when billed annually | Early usage may fit free; production auth/domain setup remains a launch dependency |
| Dodo | US cards 4% + $0.40; international +1.5%; subscriptions +0.5% | Model international card subscriptions conservatively at 6% + $0.40 |

Sources: [Railway plans](https://docs.railway.com/pricing/plans), [Railway resource pricing](https://railway.com/pricing), [Railway bucket billing](https://docs.railway.com/storage-buckets/billing), [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Vercel function pricing](https://vercel.com/docs/functions/usage-and-pricing), [Upstash pricing](https://upstash.com/pricing/redis), [Neon pricing](https://neon.com/pricing), [Clerk pricing](https://clerk.com/pricing), [Dodo pricing](https://dodopayments.com/pricing).

Vercel now offers a Pro Flat Rate CDN base allowance of 1M requests and 1TB, with additional tiers. However, bulk downloads, file hosting, and large-scale file delivery constituting most bandwidth are excluded. Our artifact traffic cannot be assumed eligible at scale. Confirm applicability with Vercel or serve artifacts directly from storage/a separately priced delivery service. On-demand regional transfer can be $0.15–$0.35/GB; the examples below use $0.15 as a stress assumption, not a claim about our current bill. [Flat Rate CDN eligibility](https://vercel.com/docs/pricing/flat-rate-cdn), [regional pricing](https://vercel.com/docs/pricing/regional-pricing).

Dodo's refund/dispute and payout fees can add costs beyond the modeled transaction fee. Include a reserve and verify the actual payment channels and payout arrangement. Do not calculate profit from tax-inclusive checkout totals. [Dodo pricing](https://dodopayments.com/pricing).

## 3. Evidence from the application and database

Current billing page: Free 250 captures, Pro $29/10,000, Scale $199/100,000. The displayed $0.012 unit price is not consistent with included plan unit rates and needs a clear definition. Credit-pack prices reside in external product configuration and were not verified. Account settlement currently charges one unit per successful capture regardless of format or resource demand.

A read-only aggregate query found 74 reservations over the last 30 days, 66 consumed and 8 released, across three Free accounts. Only 11 successful records retained detailed result data:

| Format | Detailed successes | Mean render time | Mean output bytes | Largest output bytes |
| --- | ---: | ---: | ---: | ---: |
| WebP | 4 | 5.51 seconds | 419,706 | 1,297,632 |
| PDF | 4 | 22.95 seconds | 11,177,639 | 23,652,344 |
| JPEG | 2 | 10.26 seconds | 1,287,392 | 2,348,566 |
| PNG | 1 | 15.52 seconds | 9,185,651 | 9,185,651 |

This is a small, test-heavy sample. Pruned result metadata prevents a representative cost distribution; it is not a production latency or failure-rate benchmark. One retained failed record had three attempts. Earlier single HubSpot full-page tests completed in approximately 16–18 seconds; those results do not establish latency under concurrent customer load.

### Identified cost leaks

1. **Artifact proxy:** `apps/app/src/lib/capture-artifact.ts` fetches file bytes and streams them through Vercel, with private/no-store responses. Repeated previews, downloads and PDF ranges add delivery and function work. Authenticate short links, then use expiring storage delivery where possible. Preserve ownership controls; verify CORS, Range and PDF headers. A permanently visible custom-domain file URL requires its own delivery design and budget.
2. **Polling:** active capture polling runs around once per second. A 60-second job can create approximately 60 status requests. Backoff or server-driven progress can reduce this without changing render quality.
3. **Redis heartbeat:** three commands every five seconds equals 1,555,200 commands per worker per 30 days, about $3.11 on PAYG, before queue traffic. Free 500,000 commands cannot cover even one full month of this heartbeat. Upstash itself recommends fixed pricing for BullMQ; $10 crosses the PAYG command price at roughly 5M commands, subject to capacity. [BullMQ guidance](https://upstash.com/docs/redis/integrations/bullmq).
4. **Database idle work:** settlement checks every two seconds and webhook outbox checks every second can keep Neon awake. Use event-driven processing plus bounded recovery/backoff, preserving durability.
5. **Retention:** queue result TTL is 24 hours. Expiring links/metadata does not prove bucket objects are deleted. Verify object lifecycle and orphan cleanup before promising storage retention.
6. **Capacity:** the previously observed deployed worker concurrency was one; source defaults differ. A single slot at 16 seconds/job has theoretical capacity of about 162,000 attempts per 30 days at full occupancy, or 97,000 at a 60% planning utilization. Retries and slower jobs lower successful throughput. Peaks still create queues. Account request limits are not worker capacity.

## 4. Competitor positioning

Published monthly prices, excluding annual discounts and taxes:

| Provider | Example plans | Qualification |
| --- | --- | --- |
| ScreenshotOne | $17/2,000; $79/10,000; $259/50,000 | Failed and cached captures not billed; full-page/PDF/MCP already offered |
| Urlbox | HiFi $49/5,000; Ultra $99/15,000 | Renders are weighted by duration/size and some advanced work; low-cost LoFi is not a comparable quality tier |
| ApiFlash | $7/1,000; $35/10,000; $180/100,000 | Very competitive image pricing; PDF is not listed in the reviewed pricing table |

Sources: [ScreenshotOne](https://screenshotone.com/pricing/), [Urlbox](https://urlbox.com/pricing), [ApiFlash](https://apiflash.com/).

Our proposed $29/5,000 standard viewport images is about 41% below Urlbox HiFi's $49/5,000. Growth offers 15,000 standard viewport images for $79 versus Urlbox Ultra's $99. ApiFlash remains cheaper per image. Weighted full-page/PDF workloads must be compared separately: our 15,000 credits do not mean 15,000 full-page captures.

Position as an affordable capture workspace with clear progress, complete output, private short links, and accessible API integration. Success-only billing and MCP are useful parity features, not unique advantages. Better service than competitors is a goal requiring side-by-side quality, reliability, and load tests; current evidence does not establish superiority.

## 5. Profit model and sensitivity

Budget approximately $70–$130/month for an early commercial deployment: Vercel $20, Railway roughly $20–$40, Redis $10–$20, Neon about $20–$25, and a small domain/monitoring reserve. This is an estimate, not an invoice. Extra worker capacity, paid auth features, heavy transfer and support can increase it.

Use an illustrative $100 fixed baseline and incremental cost per consumed credit of $0.001 (base), $0.002 (stress), and $0.004 (adverse). These costs are assumptions to validate, including incremental compute, retries, queue/database work and delivery. Count warm idle costs in the baseline and incremental use above it in variable costs; reconcile included provider credits to avoid double-counting.

Assume full allowance use, payment fee of 6% + $0.40, and support reserves of $1/$3/$6/$12 per Starter/Pro/Growth/Scale account:

| Plan | Base contribution | Base margin | Stress contribution | Stress margin | Adverse contribution |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter | $6.06 | 67.3% | $5.06 | 56.2% | $3.06 |
| Pro | $18.86 | 65.0% | $13.86 | 47.8% | $3.86 |
| Growth | $52.86 | 66.9% | $37.86 | 47.9% | $7.86 |
| Scale | $134.66 | 67.7% | $94.66 | 47.6% | $14.66 |

Contribution = revenue − payment fee − variable capture cost − support reserve. It is **not net profit**: shared infrastructure, free users, development, acquisition, salaries and taxes remain.

Example: 20 Pro subscribers generate $580/month. At full use and base costs, contribution is $377.20. After $100 fixed infrastructure, $87 development reserve (15% revenue) and $5 for 100 active Free users, $185.20 remains before founder pay, acquisition and taxes. At stress costs, only $85.20 remains. Adding $1,000 founder pay would make this loss-making.

Under the same simplified baseline, eight fully used Pro accounts cover infrastructure, that free pool and the development reserve at base cost; twelve at stress cost. Covering an additional $1,000 founder payment requires about 77 Pro accounts at base costs, before acquisition/taxes and any fleet expansion. Recalculate infrastructure as volume grows.

The 60% contribution-margin cost ceilings are approximately $0.00166/credit for Starter, $0.00129 for Pro, $0.00136 for Growth, and $0.00138 for Scale. The base target of $0.001 leaves some room; adverse costs do not support a sustainable business after overhead.

### Why delivery changes matter

A hypothetical 60-second render averaging 2 vCPU and 2GB RAM costs about $0.00139 on Railway's per-second rates. A 24MB upload adds about $0.00120 of service egress. Two 24MB downloads through an on-demand $0.15/GB delivery path add $0.00720. Total: approximately $0.00979 before polling, queue, database and support. Three credits would not cover this safely at our proposed subscription prices. Use storage delivery or a disclosed larger-job class; the current PDF sample demonstrates that files of this size are plausible.

For contrast, 100,000 monthly files averaging 5MB with verified one-day rolling storage retention occupy about 16.7GB steadily, around $0.25/month of bucket storage. Thirty-day rolling retention is about 500GB/$7.50. Without deletion, accumulated storage keeps growing. Transfer and rendering can dominate storage cost.

## 6. Launch gates and future features

Before finalizing prices:

1. Reconcile actual Railway, Vercel, Upstash and Neon usage/invoices with this model. Current subscribed plans and invoices were not obtained.
2. Store durable per-job dimensions, duration, bytes, attempts and charged credits without recording customer page contents. Track cost by format, full-page size, account and delivery volume; retain aggregates longer than result metadata.
3. Fix artifact delivery and verify object cleanup; reduce idle/polling work with recovery guarantees.
4. Benchmark the fleet under concurrent representative workloads, including long pages and large PDFs. Set concurrency and latency commitments from results.
5. Implement weighted credit reservation, refunds, idempotency and top-up spending caps. Update database limits, API responses, billing UI and Dodo products together; the current one-credit settlement cannot enforce the proposal.
6. Use a 30-day beta measurement window. Include failed compute and retries in cost even though customers pay only for successful output. Require measured contribution margin around 60% before annual discounts or larger allowances.
7. Keep existing core capture quality available across plans. Future AI analysis, managed proxies, video, long-term storage and contractual SLAs need their own measured allowances/add-ons. Reserve 15% revenue for ongoing development, recognizing that this is a starting budget rather than a funded engineering team.

If heavy-workload cost exceeds the target, adjust the disclosed credit class or delivery architecture before selling the allowance. Pricing cannot guarantee profit independently of workload, support burden, customer acquisition and operating discipline.

## Reproducibility

`docs/pricing-model-2026-10-11.py` generates the accompanying sensitivity CSV using explicit assumptions. The database audit script is `.qa/pricing-usage-audit.mjs`; it uses a read-only transaction and returns aggregates without identifiers. No secrets are included in this report.
