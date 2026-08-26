# Score Studio agent plugins

## Give your agents sight.

Score Studio is the computer vision layer for agents, automating data
generation, annotation, training, evaluation, workflows, and deployment in one
evidence-backed system.

This repository brings that complete vision loop to the major agent ecosystems
through one portable MCP server, without publishing private source identifiers
or internal implementation details.

## What an agent can do

- identify the signed-in user and organization memberships;
- inspect versioned datasets and model lineage;
- start tracked training jobs with explicit compute and dataset versions;
- list measured evaluations and read immutable reports;
- start evaluations against exact model/dataset version IDs;
- inspect and verify deployments;
- list and run typed workflows while reporting deferred blocks truthfully.

The MCP tools are intentionally narrower than the full Score Studio API. Delete,
billing, member administration, provider credentials, and release switching are
not exposed in the first version.

## Local server

Requires Node.js 20+. On first interactive start, choose browser OAuth or paste
an API key. The credential is saved in the platform config directory with
owner-only permissions and reused on later starts.

```bash
npm install
npm run build
npm start
```

Manage the saved login explicitly with:

```bash
npm run auth -- login
npm run auth -- logout
# or, after installing the package globally:
score-studio auth login
score-studio auth logout
```

Browser login uses Authorization Code with PKCE and a temporary loopback
callback. `SCORESTUDIO_OAUTH_ISSUER`, `SCORESTUDIO_OAUTH_METADATA_URL`,
`SCORESTUDIO_OAUTH_CLIENT_ID`, and `SCORESTUDIO_OAUTH_RESOURCE` can override
OAuth discovery settings for local or self-hosted environments. OAuth access
tokens are refreshed automatically when the server returns a refresh token.
The local CLI requests an audience matching the normalized `SCORESTUDIO_URL`
because it calls that API directly. Its registered `score-studio-cli` client
must permit loopback redirects on `http://127.0.0.1` with arbitrary ports, as
required for native-app PKCE. Hosted MCP/Claude OAuth uses a separate MCP
resource and client registration.

For CI and MCP hosts without an interactive terminal, set
`SCORESTUDIO_TOKEN`; startup fails promptly instead of waiting for input.

The API defaults to `https://api.scorestudio.ai`. Set `SCORESTUDIO_URL` only to
target another Score Studio environment.

For local Streamable HTTP development:

```bash
SCORESTUDIO_MCP_ALLOW_TOKEN_PASSTHROUGH=true npm run start:http
```

The endpoint is `http://127.0.0.1:3000/mcp`; each request must include its own
`Authorization: Bearer …` header. `/healthz` does not require authentication.
Token passthrough is intentionally limited to this explicit local-development
mode and must not be enabled on a hosted server.

## Container deployment

The production image listens on `0.0.0.0:3000` and uses the production Score
Studio API by default; callers provide their own bearer token on each request.

```bash
docker build -t score-studio-mcp .
docker run --rm -p 3000:3000 -e SCORESTUDIO_MCP_INTERNAL_TOKEN score-studio-mcp
```

In hosted mode, the MCP bearer token is exchanged through the RFC 8693 token
exchange grant at `POST /v1/oauth/token`, authenticated with
`SCORESTUDIO_MCP_INTERNAL_TOKEN`, before any Score Studio API request. The
MCP-audience token is never forwarded to the API. `SCORESTUDIO_OAUTH_ISSUER`
controls the issuer used in the OAuth protected resource challenge;
`SCORESTUDIO_MCP_RESOURCE_METADATA_URL` can override its full metadata URL.

## Packages

| Host | Package | Discovery route |
| --- | --- | --- |
| ChatGPT + Codex | `plugins/openai/score-studio` | OpenAI universal plugin directory |
| Claude Code | `plugins/claude/score-studio` | Anthropic marketplace or this repo's marketplace |
| Gemini CLI | `plugins/gemini/score-studio` | Git install and Gemini extension gallery |
| Cursor | Existing `score-studio-cursor-plugin` | Cursor Marketplace |
| Lovable | Shared remote MCP endpoint | Custom chat connector; no equivalent public plugin submission flow yet |
| GitHub Copilot / VS Code | Shared local or remote MCP endpoint | Manual MCP config, then GitHub MCP Registry when eligible |
| Windsurf | Shared local or remote MCP endpoint | MCP Marketplace submission or manual Cascade config |
| Other MCP hosts | Shared remote MCP endpoint | Streamable HTTP `/mcp` |

See [distribution.md](docs/distribution.md) for installation, deployment, and
marketplace requirements.

## Authentication and release boundary

Local packages prefer `SCORESTUDIO_TOKEN` from the host's secret configuration,
then use the saved OAuth session or API key. `SCORESTUDIO_URL` optionally targets
another Score Studio environment. Secrets are never printed.

A public ChatGPT listing cannot use this manual-token flow. It requires a stable
public HTTPS MCP endpoint plus OAuth 2.1 discovery/authorization. That hosted
OAuth boundary is deliberately left as a release gate; the repository does not
claim the package is publicly installable before it exists.

## License

Apache License 2.0.
