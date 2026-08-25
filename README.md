# Score Studio agent plugins

One Score Studio MCP server, packaged for the major agent ecosystems. The
server follows Score Studio company `main` at `29c6104` (2026-08-25) and exposes
the evidence-bearing computer-vision loop instead of a generic REST passthrough.

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

Requires Node.js 20+ and a Score Studio bearer token or API key.

```bash
npm install
npm run build
SCORESTUDIO_URL=https://your-score-studio.example \
SCORESTUDIO_TOKEN=your-token \
npm start
```

For local Streamable HTTP development:

```bash
SCORESTUDIO_URL=https://your-score-studio.example npm run start:http
```

The endpoint is `http://127.0.0.1:3000/mcp`; each request must include its own
`Authorization: Bearer …` header. `/healthz` does not require authentication.

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

Local packages read `SCORESTUDIO_URL` and `SCORESTUDIO_TOKEN` from the host's
secret configuration. They do not persist or print secrets.

A public ChatGPT listing cannot use this manual-token flow. It requires a stable
public HTTPS MCP endpoint plus OAuth 2.1 discovery/authorization. That hosted
OAuth boundary is deliberately left as a release gate; the repository does not
claim the package is publicly installable before it exists.

## License

Apache License 2.0.
