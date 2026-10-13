import { createHash } from "node:crypto";
import type { ApiKeyRecord } from "./gateway.js";

export const MCP_RESOURCE = "https://api.screenshotapi.tech/mcp";
export const OAUTH_ISSUER = "https://clerk.app.screenshotapi.tech";
export const MCP_SCOPES = ["screenshot:write", "jobs:read"];

export function createOAuthVerifier(secretKey: string | undefined, fetchImpl = fetch) {
  return async (accessToken: string): Promise<ApiKeyRecord | null> => {
    if (!secretKey || accessToken.length > 8192) return null;
    const response = await fetchImpl("https://api.clerk.com/v1/oauth_applications/access_tokens/verify", {
      method: "POST",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 400 || response.status === 401 || response.status === 404) return null;
    if (!response.ok) throw new Error("OAuth verification unavailable");
    const token = await response.json() as { object?: string; subject?: string; client_id?: string;
      scopes?: string[]; revoked?: boolean; expired?: boolean; aud?: string[] };
    if (token.object !== "clerk_idp_oauth_access_token" || !token.subject?.startsWith("user_") ||
      !token.client_id || token.revoked !== false || token.expired !== false ||
      !Array.isArray(token.aud) || !token.aud.includes(MCP_RESOURCE) ||
      !Array.isArray(token.scopes) || !token.scopes.every((value) => typeof value === "string")) return null;
    return {
      id: `oauth_${createHash("sha256").update(`${token.subject}:${token.client_id}`).digest("hex")}`,
      billing_account_id: token.subject,
      scopes: token.scopes.filter((value) => MCP_SCOPES.includes(value)),
      active: true,
    };
  };
}
