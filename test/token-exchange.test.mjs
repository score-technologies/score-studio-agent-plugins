import assert from "node:assert/strict";
import test from "node:test";

import { InternalTokenExchange, protectedResourceMetadataUrl } from "../dist/token-exchange.js";

test("builds the protected-resource metadata URL from the configurable issuer", () => {
  assert.equal(protectedResourceMetadataUrl("https://api.scorestudio.ai/", {}), "https://api.scorestudio.ai/.well-known/oauth-protected-resource/mcp");
  assert.equal(protectedResourceMetadataUrl("https://api.scorestudio.ai", { SCORESTUDIO_OAUTH_ISSUER: "https://auth.example/" }), "https://auth.example/.well-known/oauth-protected-resource/mcp");
  assert.equal(protectedResourceMetadataUrl("https://api.scorestudio.ai", { SCORESTUDIO_MCP_RESOURCE_METADATA_URL: "https://mcp.example/oauth-resource" }), "https://mcp.example/oauth-resource");
});

test("exchanges an MCP token for an API token and caches it", async () => {
  const requests = [];
  let now = 1_000_000;
  const exchange = new InternalTokenExchange({
    apiBaseUrl: "https://api.scorestudio.ai/", internalToken: "internal-secret", now: () => now,
    fetch: async (url, init) => {
      requests.push({ url, headers: init.headers, body: Object.fromEntries(new URLSearchParams(init.body)) });
      return new Response(JSON.stringify({ access_token: "api-access-token", expires_in: 120 }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(await exchange.exchange("mcp-subject-token"), "api-access-token");
  assert.equal(await exchange.exchange("mcp-subject-token"), "api-access-token");
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    url: "https://api.scorestudio.ai/v1/oauth/token",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "X-OAuth-Exchange-Secret": "internal-secret" },
    body: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "mcp-subject-token",
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: "https://api.scorestudio.ai",
    },
  });
  now += 100_000;
  await exchange.exchange("mcp-subject-token");
  assert.equal(requests.length, 2);
});

test("supports a private API address with a distinct public OAuth audience", async () => {
  let request;
  const exchange = new InternalTokenExchange({
    apiBaseUrl: "http://platform:8000",
    apiResource: "https://api.scorestudio.ai",
    internalToken: "internal-secret",
    fetch: async (url, init) => {
      request = { url, body: Object.fromEntries(new URLSearchParams(init.body)) };
      return new Response(JSON.stringify({ access_token: "api-access-token", expires_in: 120 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(await exchange.exchange("mcp-subject-token"), "api-access-token");
  assert.equal(request.url, "http://platform:8000/v1/oauth/token");
  assert.equal(request.body.resource, "https://api.scorestudio.ai");
});

test("does not include upstream details or tokens in exchange errors", async () => {
  const exchange = new InternalTokenExchange({ apiBaseUrl: "https://api.scorestudio.ai", internalToken: "internal-secret", fetch: async () => new Response(JSON.stringify({ detail: "subject-secret rejected" }), { status: 401 }) });
  await assert.rejects(() => exchange.exchange("subject-secret"), (error) => {
    assert.equal(error.message, "MCP token exchange failed (401)");
    assert.equal(error.message.includes("subject-secret"), false);
    return true;
  });
});
