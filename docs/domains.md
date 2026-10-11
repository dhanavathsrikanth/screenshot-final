# ScreenshotAPI domains

| Address | Purpose | Vercel project |
| --- | --- | --- |
| `screenshotapi.tech` | Public static landing page | `screenshotapi-landing` |
| `app.screenshotapi.tech` | Authenticated workspace | `screenshot-final` |
| `screenshot-final.vercel.app` | Temporary redirect preserving the requested path | Redirects to `app.screenshotapi.tech` |

Cloudflare DNS uses DNS-only CNAME records: `@` targets `32a256e932b0751a.vercel-dns-017.com`; `app` targets `cf78709f68e306bc.vercel-dns-017.com`. Cloudflare flattens the apex CNAME. Vercel manages HTTPS certificates. Existing image storage and email verification records are preserved.

The landing project's root directory is `apps/landing`, application preset Other, build command `pnpm run build`, and output directory `dist`. Its build reads the shared pricing catalog and copies the existing brand tokens and fonts. It needs no account, database, payment, or capture-engine credentials. Rebuild the landing project when the shared catalog changes.

On the app host, workspace pages, pricing, and documentation require Clerk authentication. Sign-in and sign-up remain accessible. The payment webhook accepts server callbacks without a browser session and must verify provider signatures. Static assets remain public so authentication pages can render.

Verified on 2026-10-11: both domain configurations are valid in Vercel; the root landing responds HTTP 200 with a valid TLS certificate using the newly published DNS answer; signed-out playground and documentation requests reach Clerk sign-in; the old app alias redirects HTTP 307 to the same path on the custom app domain. Desktop and 390px mobile landing layouts were reviewed. Some local DNS resolvers still cached the previous missing apex record at verification time.

The landing displays researched launch pricing. Deploying the landing does not activate paid subscriptions or publish the pending weighted-billing changes. The new Dodo test callback is configured at `https://app.screenshotapi.tech/api/webhook` and remains disabled until the billing implementation and secrets are deployed together. Production return URL: `https://app.screenshotapi.tech/billing?checkout=complete`. Local development retains its localhost return URL and the temporarily approved development Clerk instance.
