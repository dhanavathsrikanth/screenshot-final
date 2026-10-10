import { randomUUID } from "node:crypto";
import type { JobSnapshot } from "@snapforge/queue";
import type { StorageClient, StorageConfig } from "@snapforge/storage";

export function captureArtifactPath(jobId: string): string {
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(jobId);
  const hash = /^idem-[0-9a-f]{64}$/.test(jobId);
  const token = uuid ? `u${Buffer.from(jobId.replaceAll("-", ""), "hex").toString("base64url")}`
    : hash ? `i${Buffer.from(jobId.slice(5), "hex").toString("base64url")}` : `j${Buffer.from(jobId).toString("base64url")}`;
  return `/c/${token}`;
}

export function captureArtifactJobId(token: string): string | null {
  if (!/^[uij][A-Za-z0-9_-]+$/.test(token) || token.length > 256) return null;
  const bytes = Buffer.from(token.slice(1), "base64url");
  const hex = bytes.toString("hex");
  const id = token[0] === "u" && bytes.length === 16
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : token[0] === "i" && bytes.length === 32 ? `idem-${hex}` : token[0] === "j" ? bytes.toString("utf8") : null;
  return id && captureArtifactPath(id) === `/c/${token}` ? id : null;
}

export function captureObjectKey(artifactUrl: string, config: StorageConfig): string | null {
  const url = new URL(artifactUrl);
  const endpoint = new URL(config.endpoint ?? `https://s3.${config.region}.amazonaws.com`);
  const cdn = config.cdnBaseUrl ? new URL(config.cdnBaseUrl.replace(/\/+$/, "") + "/") : null;
  let key: string;
  if (cdn && url.origin === cdn.origin && url.pathname.startsWith(cdn.pathname)) key = url.pathname.slice(cdn.pathname.length);
  else if (url.origin === endpoint.origin && url.pathname.startsWith(`/${config.bucket}/`)) key = url.pathname.slice(config.bucket.length + 2);
  else if (url.protocol === endpoint.protocol && url.host === `${config.bucket}.${endpoint.host}`) key = url.pathname.slice(1);
  else return null;
  const match = /^captures\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{64})\.(png|jpeg|jpg|webp|pdf)$/.exec(key);
  return match && match[3].startsWith(match[1] + match[2]) ? key : null;
}

export interface CaptureArtifactDependencies {
  authenticate(): Promise<string | null>;
  storedCapture?(accountId: string, jobId: string): Promise<JobSnapshot | null>;
  lookup(accountId: string, jobId: string, requestId: string): Promise<JobSnapshot>;
  storage(): { config: StorageConfig; client: Pick<StorageClient, "urlFor"> };
  fetch?: typeof fetch;
}

export function createCaptureArtifactHandler(deps: CaptureArtifactDependencies) {
  return async (request: Request, token: string): Promise<Response> => {
    const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
    try {
      const accountId = await deps.authenticate();
      if (!accountId) return new Response("Sign in to view this capture", { status: 401, headers });
      const jobId = captureArtifactJobId(token);
      if (!jobId) return new Response("Capture not found", { status: 404, headers });
      let snapshot: JobSnapshot;
      try { snapshot = (await deps.storedCapture?.(accountId, jobId)) ?? await deps.lookup(accountId, jobId, randomUUID()); }
      catch { return new Response("Capture not found or no longer available", { status: 404, headers }); }
      const data = snapshot.result?.ok ? snapshot.result.data : undefined;
      if (!data?.cdn_url) return new Response("Capture not available", { status: 404, headers });
      const { config, client } = deps.storage();
      const key = captureObjectKey(data.cdn_url, config);
      const types: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };
      if (!key || !types[data.format]) return new Response("Capture not available", { status: 404, headers });
      const range = request.headers.get("range");
      const upstream = await (deps.fetch ?? fetch)(await client.urlFor(key), {
        headers: range ? { range } : {}, redirect: "error", signal: AbortSignal.timeout(30_000),
      });
      if (upstream.status === 416) {
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) headers.set("content-range", contentRange);
        return new Response(null, { status: 416, headers });
      }
      if (!upstream.ok) return new Response("Capture storage unavailable", { status: upstream.status === 404 ? 404 : 502, headers });
      headers.set("content-type", types[data.format]);
      const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
      headers.set("content-disposition", `${disposition}; filename="capture.${data.format}"`);
      for (const name of ["content-length", "content-range", "accept-ranges"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return new Response("Capture delivery temporarily unavailable", { status: 503, headers });
    }
  };
}
