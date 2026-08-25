#!/usr/bin/env node
import { createServer } from "node:http";

import { toNodeHandler, type NodeIncomingMessageLike, type NodeServerResponseLike } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { buildServer, DEFAULT_SCORESTUDIO_URL } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const baseUrl = process.env.SCORESTUDIO_URL ?? DEFAULT_SCORESTUDIO_URL;

const handler = createMcpHandler(({ requestInfo }) => {
  const authorization = requestInfo?.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  return buildServer({ baseUrl, token });
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
    response.writeHead(401, { "content-type": "application/json" });
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
