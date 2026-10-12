# ScreenshotAPI naming

The public product name is **ScreenshotAPI**, matching `screenshotapi.tech`.
The authenticated workspace and documentation live at `app.screenshotapi.tech`.
Workspace packages use `@screenshotapi/*`; the local MCP command is `screenshotapi-mcp`.
These names describe repository packages; they do not imply publication on npm.

REST examples use `SCREENSHOTAPI_API_URL` for the actual deployed gateway and
`SCREENSHOTAPI_API_KEY` for its bearer key. The console's session-authenticated
capture route is separate from the public REST gateway. No new API hostname is
assumed to be configured by this rename.

Deployment settings accept the new `SCREENSHOTAPI_*` names and fall back to
existing `SNAPFORGE_*` values. Existing PostgreSQL enum names, Redis queue and
reservation namespaces, browser preferences, pending capture keys, and API key
prefixes remain stable to preserve existing accounts and captures. Historical
SQL migrations remain unchanged.

New checkout metadata includes `screenshotapi_user_id` and the legacy owner field
for deployments during rollout. Verified provider records accept either name;
conflicting identities are rejected. Capture callbacks send `X-ScreenshotAPI-*`
headers together with matching legacy header aliases, using the same signature
and body. Clerk and Dodo webhook endpoint URLs remain the established URLs on
the app domain.
