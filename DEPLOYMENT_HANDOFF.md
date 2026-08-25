# Score Studio API and MCP deployment handoff

Deploy the Score Studio API and MCP server on Score Technologies infrastructure.

## 1. Score Studio API

- Public domain: `https://api.scorestudio.ai`
- Point the domain's DNS record to the company VPS or load balancer.
- Terminate HTTPS with a valid public TLS certificate.
- Reverse-proxy requests to the Score Studio platform API on port `8000`.
- Preserve the `Authorization` header.
- Configure the production environment:

```dotenv
PLATFORM_PUBLIC_API_URL=https://api.scorestudio.ai
NEXT_PUBLIC_API_URL=https://api.scorestudio.ai
```

Do not commit production credentials. Load them from the company's secret
manager or protected VPS environment.

## 2. Score Studio MCP server

- Repository: <https://github.com/score-technologies/score-studio-agent-plugins>
- Public domain: `https://mcp.scorestudio.ai`
- Build the root `Dockerfile`.
- Expose container port `3000` through HTTPS.
- Configure the container:

```dotenv
SCORESTUDIO_URL=https://api.scorestudio.ai
HOST=0.0.0.0
PORT=3000
```

The public routes are:

- `GET /healthz` — unauthenticated health check;
- `/mcp` — Streamable HTTP MCP endpoint requiring a bearer token.

The reverse proxy must preserve `Authorization` headers and disable response
buffering for `/mcp`. The MCP service must not log or persist user bearer
tokens.

## Acceptance tests

Run these checks from outside the company network:

```bash
curl -i https://api.scorestudio.ai/healthz
curl -i https://mcp.scorestudio.ai/healthz
curl -i -X POST https://mcp.scorestudio.ai/mcp
```

Expected results:

- both health checks return HTTP `200`;
- the unauthenticated `/mcp` request returns HTTP `401`;
- both domains present valid HTTPS certificates;
- `api.scorestudio.ai` serves the Score Studio API rather than the web frontend.

## Package setup after deployment

The npm package uses `https://api.scorestudio.ai` as its built-in production
default. Local users only need:

```bash
SCORESTUDIO_TOKEN=your-token npm start
```

`SCORESTUDIO_URL` remains available as an optional override for staging,
self-hosted, or local Score Studio environments.
