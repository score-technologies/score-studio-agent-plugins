#!/usr/bin/env node
import { createServer } from "node:http";

import { toNodeHandler, type NodeIncomingMessageLike, type NodeServerResponseLike } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { buildServer, DEFAULT_SCORESTUDIO_URL } from "./server.js";
import { InternalTokenExchange, protectedResourceMetadataUrl } from "./token-exchange.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const baseUrl = process.env.SCORESTUDIO_URL ?? DEFAULT_SCORESTUDIO_URL;
const apiResource = process.env.SCORESTUDIO_API_RESOURCE ?? baseUrl;
const exchangeSecret = process.env.SCORESTUDIO_MCP_EXCHANGE_SECRET;
const allowPassthrough = process.env.SCORESTUDIO_MCP_ALLOW_TOKEN_PASSTHROUGH === "true";
if (!exchangeSecret && !allowPassthrough) {
  throw new Error("Hosted MCP requires SCORESTUDIO_MCP_EXCHANGE_SECRET. For local API-token development only, set SCORESTUDIO_MCP_ALLOW_TOKEN_PASSTHROUGH=true.");
}
const exchange = exchangeSecret
  ? new InternalTokenExchange({ apiBaseUrl: baseUrl, apiResource, internalToken: exchangeSecret })
  : undefined;
const resourceMetadata = protectedResourceMetadataUrl(baseUrl);

const handler = createMcpHandler(async ({ requestInfo }) => {
  const authorization = requestInfo?.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const apiToken = exchange ? await exchange.exchange(token) : token;
  return buildServer({ baseUrl, token: apiToken });
});
const handleMcp = toNodeHandler(handler);

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  if (path === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "score-studio-mcp" }));
    return;
  }
  if (path !== "/mcp") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  if (!request.headers.authorization?.match(/^Bearer\s+\S+/i)) {
    response.writeHead(401, {
      "content-type": "application/json",
      "www-authenticate": `Bearer resource_metadata="${resourceMetadata}"`,
    });
    response.end(JSON.stringify({ error: "missing_bearer_token" }));
    return;
  }
  await handleMcp(
    request as unknown as NodeIncomingMessageLike,
    response as unknown as NodeServerResponseLike,
  );
});

server.listen(port, host, () => {
  console.error(`Score Studio MCP listening on http://${host}:${port}/mcp`);
});

const shutdown = async () => {
  await handler.close();
  server.close();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
