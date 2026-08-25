import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";

import { buildServer } from "../dist/server.js";

test("lists tools and forwards authenticated Score Studio requests", async (t) => {
  const requests = [];
  const api = createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "user-1", memberships: [{ slug: "score" }] }));
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  t.after(() => api.close());
  const address = api.address();
  assert.equal(typeof address, "object");

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildServer({
    baseUrl: `http://127.0.0.1:${address.port}`,
    token: "test-token",
  });
  await server.connect(serverTransport);
  t.after(() => server.close());

  const client = new Client({ name: "test", version: "0.1.0" });
  await client.connect(clientTransport);
  t.after(() => client.close());

  const tools = await client.listTools();
  assert.equal(tools.tools.length, 12);
  assert.ok(tools.tools.some((tool) => tool.name === "scorestudio_verify_deployment"));

  const response = await client.callTool({ name: "scorestudio_whoami", arguments: {} });
  assert.equal(response.isError, undefined);
  assert.deepEqual(requests, [{ url: "/v1/auth/me", authorization: "Bearer test-token" }]);
});
