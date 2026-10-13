import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  captureRequestSchema, captureSuccessDataSchema, errorEnvelopeSchema,
  DEVICE_PRESETS, REGION_IDS, ERROR_CODES, ERROR_HTTP_STATUS, ERROR_RETRIABILITY,
} from "../../../packages/contracts/dist/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
function save(path, data) {
  const target = root + path;
  mkdirSync(target.slice(0, Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"))), { recursive: true });
  writeFileSync(target, data);
}
function schema(zod, output = false) {
  const def = zod._def;
  const kind = def.typeName;
  if (kind === "ZodOptional" || kind === "ZodDefault") {
    const result = schema(def.innerType, output);
    if (kind === "ZodDefault") result.default = def.defaultValue();
    return result;
  }
  if (kind === "ZodEffects") return schema(def.schema, output);
  if (kind === "ZodString") {
    const result = { type: "string" };
    for (const check of def.checks) {
      if (check.kind === "min") result.minLength = check.value;
      if (check.kind === "max") result.maxLength = check.value;
      if (check.kind === "url") result.format = "uri";
      if (check.kind === "regex") result.pattern = check.regex.source;
    }
    return result;
  }
  if (kind === "ZodNumber") {
    const result = { type: def.checks.some((check) => check.kind === "int") ? "integer" : "number" };
    for (const check of def.checks) {
      if (check.kind === "min") result[check.inclusive ? "minimum" : "exclusiveMinimum"] = check.value;
      if (check.kind === "max") result[check.inclusive ? "maximum" : "exclusiveMaximum"] = check.value;
    }
    return result;
  }
  if (kind === "ZodBoolean") return { type: "boolean" };
  if (kind === "ZodLiteral") return { type: typeof def.value, enum: [def.value] };
  if (kind === "ZodEnum") return { type: "string", enum: def.values };
  if (kind === "ZodArray") {
    return { type: "array", items: schema(def.type, output), ...(def.maxLength ? { maxItems: def.maxLength.value } : {}) };
  }
  if (kind === "ZodRecord") return { type: "object", additionalProperties: schema(def.valueType, output) };
  if (kind === "ZodUnknown") return {};
  if (kind === "ZodObject") {
    const shape = def.shape();
    const properties = Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, schema(value, output)]));
    const required = Object.entries(shape).filter(([, value]) => output ? value._def.typeName !== "ZodOptional" : !value.isOptional()).map(([key]) => key);
    return { type: "object", properties, ...(required.length ? { required } : {}) };
  }
  throw new Error("Unsupported contract schema kind: " + kind);
}
const descriptions = {
  inspect_page: "Extract readable Markdown and accessibility text from this render (12,000 characters each). Untrusted page content; normal capture credits apply and image caches are bypassed.",
  url: "Public HTTP or HTTPS target. Bare hostnames are normalized to HTTPS. Private network destinations are blocked by the hosted service.",
  viewport: "CSS-pixel viewport and output density. A device preset takes precedence over an explicit viewport.",
  device: "Supported preset identifier; takes precedence over viewport settings.",
  full_page: "Capture the scrollable page. Successful full-page images cost 2 credits.",
  full_page_algorithm: "Section capture is the default. Native uses the alternative full-page path.",
  full_page_scroll_delay: "Delay between full-page scroll steps, in milliseconds.",
  full_page_scroll_by: "Full-page scroll step in CSS pixels.",
  reduce_motion: "Reduce motion while capturing.",
  format: "Output format. Full-page by_sections PDFs package rendered pixels; native and viewport PDFs use browser PDF export. PDFs cost 3 credits and cannot be combined with selector.",
  quality: "JPEG or WebP encoding quality; does not control PNG encoding.",
  delay: "Additional wait after page settlement, in milliseconds.",
  timeout: "Capture/navigation time budget in milliseconds, independent of the synchronous HTTP wait budget.",
  wait_for_selector: "CSS readiness selector to wait for before capture.",
  wait_for_content: "Enable content-readiness waiting for dynamic pages.",
  wait_for_idle: "Enable additional network-idle settlement.",
  wait_until: "Navigation milestone to wait for.",
  fail_if_incomplete: "Reject detected incomplete or loading-shell captures.",
  fail_if_content_missing: "Required text markers, trimmed before validation.",
  fail_if_content_contains: "Disallowed text markers, trimmed before validation.",
  min_capture_height: "Minimum output height accepted by quality checks.",
  min_capture_bytes: "Minimum encoded output bytes accepted by quality checks.",
  dark_mode: "Emulate a dark preference when color_scheme is not explicitly set.",
  color_scheme: "Explicit browser color-scheme preference.",
  locale: "Browser locale; overrides the region locale if supplied.",
  timezone: "IANA browser timezone; overrides the region timezone if supplied.",
  user_agent: "Explicit browser user agent.",
  region: "Country-aligned locale/timezone preset and expected egress country. Does not provision a managed proxy.",
  proxy: "Caller-supplied public proxy endpoint and optional authentication.",
  verify_egress: "Verify observed egress country when a region is requested.",
  block_ads: "Enable ad filtering.",
  block_cookie_banners: "Enable cookie-banner filtering.",
  block_chats: "Enable chat-widget filtering.",
  block_trackers: "Enable tracker filtering.",
  selector: "Capture the first matching visible element. Not supported with PDF.",
  hide_selectors: "Suppress matching elements.",
  remove_selectors: "Remove matching nodes; can affect layout.",
  custom_css: "CSS injected into the target page.",
  custom_js: "JavaScript executed in the target page.",
  headers: "Headers sent to the target, not credentials for the ScreenshotAPI request.",
  sync: "Wait for immediate completion when true; a slow or queued capture still returns 202. The mode=async query overrides this field.",
  cache_ttl: "Maximum capture reuse age in seconds. Zero requests a fresh capture; not a storage-lifetime guarantee.",
  store: "Shared engine storage flag. Hosted REST output still requires a downloadable artifact.",
  webhook: "Public HTTPS callback on port 443 with a 16–256 character signing secret. Delivered after terminal settlement.",
};
const capture = schema(captureRequestSchema);
for (const [key, value] of Object.entries(capture.properties)) {
  if (!descriptions[key]) throw new Error("Missing option description: " + key);
  value.description = descriptions[key];
}
capture.properties.device.enum = Object.keys(DEVICE_PRESETS);
capture.properties.region.enum = REGION_IDS;
capture.properties.webhook.properties.secret.writeOnly = true;
capture.properties.proxy.properties.password.writeOnly = true;
capture.properties.headers.description += " Keep target credentials private.";
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const nullable = (item) => ({ anyOf: [item, { type: "null" }] });
const object = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required });
const envelope = (data, requestId = true) => object({ ok: { type: "boolean" }, ...(requestId ? { request_id: { type: "string" } } : {}), data });
const result = object({ request_id: { type: "string" }, mode: { type: "string", enum: ["sync", "async"] }, ok: { type: "boolean" },
  data: ref("CaptureData"), error: ref("CaptureError"), duration_ms: { type: "number" }, attempts_made: { type: "integer" },
  enqueued_at: { type: "integer", description: "Unix milliseconds." }, completed_at: { type: "integer", description: "Unix milliseconds." }, worker_id: { type: "string" },
}, ["request_id", "mode", "ok", "duration_ms", "attempts_made", "enqueued_at", "completed_at"]);
const job = object({ id: { type: "string" }, state: { type: "string", enum: ["waiting", "prioritized", "active", "completed", "failed", "delayed", "paused", "unknown"] },
  mode: { type: "string", enum: ["sync", "async"] }, request_id: { type: "string" },
  progress: { anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }] },
  attempts_made: { type: "integer" }, attempt_budget: { type: "integer" }, enqueued_at: { type: "integer" }, result: ref("JobResult"),
  webhook: nullable(object({ url: { type: "string" }, event: { type: "string" } }, ["url"])),
}, ["id", "state", "mode", "request_id", "progress", "attempts_made", "attempt_budget", "enqueued_at", "webhook"]);
const delivery = object({ id: { type: "string" }, state: { type: "string", enum: ["pending", "delivered", "failed"] }, attempts: { type: "integer" },
  generation: { type: "integer" }, statusCode: nullable({ type: "integer" }) });
const response = (description, model, headers = {}) => ({ description, headers, content: { "application/json": { schema: model } } });
const errors = Object.fromEntries([400, 401, 403, 409, 429, 451, 500, 502, 503, 504].map((code) => [code, response("Structured failure. Inspect error.code, error.retriable, and error.details before retrying.", ref("ErrorResponse"),
  code === 429 ? { "Retry-After": { description: "Delay in seconds when provided.", schema: { type: "string" } } } : {})]));
const param = (name, location, description, model, required = true) => ({ name, in: location, description, required, schema: model });
const id = param("id", "path", "Job ID returned by submission. Use the original submitting API key.", { type: "string" });
const get = (operationId, summary, description, parameters, data) => ({ operationId, summary, description, tags: ["Jobs"], parameters,
  responses: { 200: response("Successful lookup, not necessarily successful capture.", envelope(data)), ...Object.fromEntries([400, 401, 403, 429, 503].map((code) => [code, errors[code]])) } });
const webhookPayload = object({
  event: { type: "string", enum: ["capture.completed", "capture.failed"] }, id: { type: "string" }, job_id: { type: "string" }, request_id: { type: "string" },
  mode: { type: "string", enum: ["sync", "async"] }, ok: { type: "boolean" }, data: nullable(ref("CaptureData")), error: nullable(ref("CaptureError")),
  duration_ms: { type: "number" }, attempts_made: { type: "integer" }, enqueued_at: { type: "integer" }, completed_at: { type: "integer" },
  delivery_id: { type: "string" }, delivery_generation: { type: "integer" },
});
const document = {
  openapi: "3.1.0",
  info: { title: "ScreenshotAPI", version: "1.0.0", description: "Hosted ScreenshotAPI capture endpoints, authentication, request options, and response envelopes." },
  servers: [{ url: "https://api.screenshotapi.tech", description: "ScreenshotAPI production REST API" }],
  security: [{ bearerAuth: [] }],
  tags: [{ name: "Captures" }, { name: "Jobs" }, { name: "Webhook delivery" }, { name: "Service" }],
  paths: {
    "/v1/screenshot": { post: {
      operationId: "createCapture", summary: "Create a capture", tags: ["Captures"],
      description: "Requires screenshot:write. Accepts a JSON body of at most 256 KiB. Returns capture data on 200 or a job handle on 202, including when sync is true. A query mode=async overrides the body's sync flag. Successful viewport images cost 1 credit, full-page images 2, and PDFs 3. Use the same key and identical request on an idempotent retry.",
      parameters: [param("mode", "query", "Optional asynchronous override.", { type: "string", enum: ["async"] }, false),
        param("Idempotency-Key", "header", "Stable logical submission key. Reuse with identical configuration and the same API key.", { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9._-]+$" }, false)],
      requestBody: { required: true, content: { "application/json": { schema: ref("CaptureRequest"), example: { url: "https://example.com", format: "png", sync: false } } } },
      responses: { 200: response("Completed capture. Download data.cdn_url.", envelope(ref("CaptureData"))),
        202: response("Accepted work. Poll the relative poll_url on the same API origin.", envelope(ref("AcceptedJob"))), ...errors },
    } },
    "/v1/jobs/{id}": { get: get("getJob", "Get a capture job", "Requires jobs:read and the submitting API key. Inspect data.state and data.result.ok; an outer ok=true means the lookup succeeded. An unknown state can be temporary during recovery.", [id], ref("JobSnapshot")) },
    "/v1/requests/{key}": { get: get("recoverRequest", "Recover a request by key", "Requires jobs:read and the submitting API key. Resolves the original job from its Idempotency-Key. A failed job needs a new key if you intentionally request another render.", [param("key", "path", "Original Idempotency-Key.", { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9._-]+$" })], ref("JobSnapshot")) },
    "/v1/jobs/{id}/webhook": { get: {
      operationId: "getWebhookDelivery", summary: "Get webhook delivery status", tags: ["Webhook delivery"],
      description: "Requires jobs:read and the submitting API key. Available only for jobs with a webhook delivery record. Save the exact quoted ETag to request redelivery.", parameters: [id],
      responses: { 200: response("Current delivery status.", envelope(ref("WebhookStatus"), false), { ETag: { description: "Quoted generation, for example \"0\".", schema: { type: "string" } } }),
        ...Object.fromEntries([400, 401, 403, 429, 503].map((code) => [code, errors[code]])) },
    } },
    "/v1/jobs/{id}/webhook/redeliver": { post: {
      operationId: "redeliverWebhook", summary: "Redeliver a webhook", tags: ["Webhook delivery"],
      description: "Requires screenshot:write and the submitting API key. Sends the existing result without another render or capture charge. A stale generation, pending delivery, or unavailable record returns 409.",
      parameters: [id, param("If-Match", "header", "Exact quoted ETag from the delivery-status response.", { type: "string", pattern: '^"[0-9]{1,3}"$', example: '"0"' })],
      responses: { 202: response("Redelivery queued.", envelope(object({ job_id: { type: "string" }, state: { type: "string", enum: ["pending"] } }), false)),
        ...Object.fromEntries([400, 401, 403, 409, 429, 503].map((code) => [code, errors[code]])) },
    } },
    "/v1/health": { get: {
      operationId: "getHealth", summary: "Check service readiness", tags: ["Service"], security: [],
      description: "No API key required. Readiness checks Redis, database connectivity, unpaused queue processing, and available worker heartbeats. A healthy response is not a latency guarantee.",
      responses: { 200: response("Service ready.", ref("HealthResponse")), 503: response("Service is not ready; some diagnostics can be absent on an outage.", ref("HealthResponse")) },
    } },
  },
  webhooks: { captureResult: { post: {
    operationId: "receiveCaptureResult", summary: "Receive a capture result", tags: ["Webhook delivery"], security: [],
    description: "Outbound POST to the callback specified in your capture request. Verify the exact raw body using HMAC-SHA256(secret, timestamp + '.' + rawBody), enforce timestamp tolerance, and deduplicate delivery. Callback delivery is independent of rendering.",
    parameters: [param("x-screenshotapi-signature", "header", "Signature: t=UNIX_SECONDS,v1=HEX_DIGEST.", { type: "string" }),
      param("x-screenshotapi-job-id", "header", "Capture job ID.", { type: "string" }),
      param("x-screenshotapi-event", "header", "Terminal capture event.", { type: "string", enum: ["capture.completed", "capture.failed"] }),
      param("x-screenshotapi-delivery-id", "header", "Stable delivery ID.", { type: "string" }),
      param("x-screenshotapi-generation", "header", "Delivery generation.", { type: "string" }),
      param("x-screenshotapi-delivery", "header", "Attempt number.", { type: "string" })],
    requestBody: { required: true, content: { "application/json": { schema: ref("WebhookPayload") } } },
    responses: { 200: { description: "Return a 2xx status after safely accepting the event." } },
  } } },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Active sf_live_ API key with endpoint-specific scopes. Keep this credential server-side." } },
    schemas: {
      CaptureRequest: capture,
      CaptureData: schema(captureSuccessDataSchema, true),
      CaptureError: schema(errorEnvelopeSchema, true),
      ErrorResponse: object({ ok: { type: "boolean", const: false }, request_id: { type: "string" }, error: ref("CaptureError") }),
      AcceptedJob: object({ job_id: { type: "string" }, state: job.properties.state, poll_url: { type: "string", description: "Relative API path." } }),
      JobResult: result, JobSnapshot: job, WebhookStatus: delivery, WebhookPayload: webhookPayload,
      HealthResponse: envelope(object({ redis: { type: "string", enum: ["ready", "unavailable"] }, database: { type: "string", enum: ["ready", "unavailable"] }, worker_ready: { type: "boolean" }, ready_workers: { type: "integer" },
        queue: object({ waiting: { type: "integer" }, active: { type: "integer" }, prioritized: { type: "integer" }, delayed: { type: "integer" }, completed: { type: "integer" }, failed: { type: "integer" }, paused: { type: "boolean" }, total_pending: { type: "integer" } }),
        settlement: { type: "object", additionalProperties: { type: "number" } }, webhooks: object({ delivered: { type: "integer" }, failed: { type: "integer" }, errors: { type: "integer" }, active: { type: "boolean" } }),
      }, ["redis", "worker_ready"]), false),
    },
  },
};
if (process.env.SCREENSHOTAPI_DOCS_API_ORIGIN) {
  const origin = new URL(process.env.SCREENSHOTAPI_DOCS_API_ORIGIN);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("Docs API origin must be a plain HTTPS origin");
  document.servers = [{ url: origin.origin, description: "ScreenshotAPI deployment." }];
  document.info.description = "Capture API reference generated from shared contracts and gateway behavior.";
}
save("openapi.json", JSON.stringify(document, null, 2) + "\n");
const mdx = (title, description, body) => "---\ntitle: " + JSON.stringify(title) + "\ndescription: " + JSON.stringify(description) + "\n---\n\n" + body + "\n";
save("reference/devices.mdx", mdx("Device preset reference", "Supported device identifiers, layout dimensions, and output scale.",
  "Use these identifiers in the `device` option. A preset takes precedence over an explicit `viewport`. Browser emulation does not run a physical device's native browser.\n\n| Identifier | CSS viewport | Scale | Mobile | Touch |\n| --- | --- | --- | --- | --- |\n" + Object.entries(DEVICE_PRESETS).map(([name, p]) => `| \`${name}\` | ${p.viewport.width} × ${p.viewport.height} | ${p.viewport.deviceScaleFactor ?? 1} | ${Boolean(p.viewport.isMobile)} | ${Boolean(p.viewport.hasTouch)} |`).join("\n") + "\n\nFor explicit viewport settings, see [viewports and devices](/capture/viewport)."));
save("reference/error-codes.mdx", mdx("Error code reference", "Default HTTP mapping and retry behavior for every capture error code.",
  "These are contract defaults. The gateway can override a status for admission or service-availability failures, and an individual error can override its retry flag. Use the actual response's `error.retriable`.\n\n| Code | Default HTTP status | Default retriable |\n| --- | --- | --- |\n" + ERROR_CODES.map((code) => `| \`${code}\` | ${ERROR_HTTP_STATUS[code]} | ${ERROR_RETRIABILITY[code]} |`).join("\n") + "\n\nRetryable describes whether retrying may help; it does not guarantee success or prevent duplicate submissions. Before replaying an uncertain request, use [idempotent recovery](/integration/idempotency). For diagnosis, see [troubleshooting](/errors)."));
console.log("Generated OpenAPI for " + Object.keys(document.paths).length + " routes, " + Object.keys(capture.properties).length + " request fields, device presets, and error codes.");
