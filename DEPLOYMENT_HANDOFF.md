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
PLATFORM_WEB_APP_URL=https://scorestudio.ai
PLATFORM_OAUTH_ISSUER=https://api.scorestudio.ai
PLATFORM_OAUTH_RESOURCE=https://api.scorestudio.ai
PLATFORM_OAUTH_MCP_RESOURCE=https://mcp.scorestudio.ai/mcp
PLATFORM_OAUTH_EXCHANGE_SECRET=<dedicated-random-secret-at-least-32-characters>
PLATFORM_INTERNAL_API_TOKEN=<shared-random-secret>
PLATFORM_CORS_ORIGINS=["https://scorestudio.ai"]
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
SCORESTUDIO_OAUTH_ISSUER=https://api.scorestudio.ai
SCORESTUDIO_API_RESOURCE=https://api.scorestudio.ai
SCORESTUDIO_MCP_EXCHANGE_SECRET=<same-dedicated-random-secret>
HOST=0.0.0.0
PORT=3000
```

The public routes are:

- `GET /healthz` — unauthenticated health check;
- `/mcp` — Streamable HTTP MCP endpoint requiring a bearer token.

The reverse proxy must preserve `Authorization` headers and disable response
buffering for `/mcp`. The MCP service must not log or persist user bearer
tokens.

`SCORESTUDIO_URL` may instead be a private service address such as
`http://platform:8000`. When it is private, keep `SCORESTUDIO_API_RESOURCE` set
to the exact public OAuth audience (`https://api.scorestudio.ai`); otherwise the
RFC 8693 exchange is rejected with `invalid_target`.

## Claude connector requirements

- Add `https://mcp.scorestudio.ai/mcp` as the custom connector URL.
- Dynamic client registration must accept Claude's callback URL:
  `https://claude.ai/api/mcp/auth_callback`.
- Authorization Code with PKCE (`S256`), refresh-token rotation, and OAuth
  protected-resource metadata must remain enabled.
- The protected resource must be the exact MCP URL, including `/mcp`.
- The login/consent web origin must be included in `PLATFORM_CORS_ORIGINS` so
  the approval POST passes origin and CSRF validation.
- Production API replicas must share stable JWT signing keys. Ephemeral local
  keys invalidate browser sessions whenever the API restarts.

For local Claude testing, Claude cannot reach `localhost`. Expose a single
HTTPS tunnel and route these paths on the same public origin:

- `/mcp` to the MCP gateway;
- `/v1/*`, `/.well-known/*`, `/healthz`, and `/readyz` to the platform API;
- all remaining paths to the web app.

Using one origin keeps login cookies first-party. Configure the public tunnel
origin as `PLATFORM_PUBLIC_API_URL`, `PLATFORM_WEB_APP_URL`,
`PLATFORM_OAUTH_ISSUER`, `PLATFORM_OAUTH_RESOURCE`, `NEXT_PUBLIC_API_URL`, and
`SCORESTUDIO_API_RESOURCE`; configure `PLATFORM_OAUTH_MCP_RESOURCE` as that
origin plus `/mcp`. Restart the web build after changing `NEXT_PUBLIC_API_URL`.

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
- its `WWW-Authenticate` header links to the MCP protected-resource metadata;
- both domains present valid HTTPS certificates;
- `api.scorestudio.ai` serves the Score Studio API rather than the web frontend.
- Claude completes consent, exchanges the code, initializes MCP, lists tools,
  and successfully invokes a read-only tool.

## Package setup after deployment

The npm package uses `https://api.scorestudio.ai` as its built-in production
default. Local users only need:

```bash
SCORESTUDIO_TOKEN=your-token npm start
```

`SCORESTUDIO_URL` remains available as an optional override for staging,
self-hosted, or local Score Studio environments.
