# Hosted MCP capture adapter

The public API serves Streamable HTTP MCP at https://api.screenshotapi.tech/mcp using the official MCP SDK 1.31.0. Each request authenticates an active scoped account API key, applies request limits, validates Origin when present, and bounds request bodies to 256 KiB. The adapter delegates to the existing REST routes in-process, preserving ownership checks, durable submission idempotency, shared worker admission, and billing finalization. No browser runs in the MCP web process.

Tools: prepare_capture, take_screenshot, capture_element, get_capture_job, recover_capture_request. Preparation generates a stable retry key and estimates credits without charging. Captures return bounded metadata and artifact links, with asynchronous job handles. Credentials are supplied by the client transport, never exposed as model-visible tool arguments.

The dashboard API keys page provides dedicated agent-key creation and copyable MCP connection settings. Mintlify and console guidance cover connection, retries, job tracking, credit policy, and revocation.

Verification: gateway regression suite includes official SDK HTTP client interoperability, discovery, estimates, durable capture replay, conflicts, account isolation, scopes, revocation, origin rejection, oversized bodies, rate limits, and existing REST billing behavior.

Limitations: OAuth sign-in onboarding and account-visible OAuth connection management are not implemented. Clients must support custom Bearer headers. Hosted readable-page inspection, inline image slices, and an account-usage tool remain follow-up work. Existing local stdio is not the customer hosted connection. MCP cancellation does not cancel an already accepted durable capture or refund a successful capture.
