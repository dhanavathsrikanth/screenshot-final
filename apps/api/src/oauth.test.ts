import test from "node:test";
import assert from "node:assert/strict";
import { createOAuthVerifier, MCP_RESOURCE } from "./oauth.js";

const valid = { object: "clerk_idp_oauth_access_token", subject: "user_fixture", client_id: "client_fixture",
  scopes: ["screenshot:write", "jobs:read", "private_metadata"], revoked: false, expired: false, aud: [MCP_RESOURCE] };

test("OAuth verification binds account, client, audience and granted scopes", async () => {
  let body = valid;
  const verify = createOAuthVerifier("test-only-secret", (async (url, init) => {
    assert.equal(url, "https://api.clerk.com/v1/oauth_applications/access_tokens/verify");
    assert.equal(JSON.parse(init!.body as string).access_token, "oauth-fixture");
    return Response.json(body);
  }) as typeof fetch);
  const first = await verify("oauth-fixture");
  assert.equal(first?.billing_account_id, "user_fixture");
  assert.deepEqual(first?.scopes, ["screenshot:write", "jobs:read"]);
  assert.equal((await verify("oauth-fixture"))?.id, first?.id);
  for (const change of [{ revoked: true }, { expired: true }, { aud: [] }, { aud: ["https://other.example/mcp"] },
    { subject: "org_fixture" }, { object: "session" }, { client_id: "" }]) {
    body = { ...valid, ...change };
    assert.equal(await verify("oauth-fixture"), null);
  }
});

test("OAuth verification fails closed on configuration and provider failures", async () => {
  assert.equal(await createOAuthVerifier(undefined)("token"), null);
  assert.equal(await createOAuthVerifier("secret", (async () => new Response(null, { status: 401 })) as typeof fetch)("token"), null);
  await assert.rejects(createOAuthVerifier("secret", (async () => new Response(null, { status: 503 })) as typeof fetch)("token"));
});
