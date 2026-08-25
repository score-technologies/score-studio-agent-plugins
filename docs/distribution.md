# Distribution plan

## Shared release order

1. Publish `@score-technologies/score-studio-mcp` to npm for local plugin hosts.
2. Deploy the HTTP server at a stable Score Technologies HTTPS domain with
   `/mcp` and `/healthz`.
3. Add OAuth 2.1 protected-resource metadata and an authorization flow that
   exchanges a Score Studio user session for scoped MCP access.
4. Publish privacy policy, terms, support, and plugin documentation URLs.
5. Test all read/write tools with a least-privilege production account.
6. Submit thin platform packages; keep the tool names and semantics identical.

## ChatGPT and Codex

Package: `plugins/openai/score-studio`.

Before public submission:

- register the hosted MCP server in ChatGPT developer mode and replace the
  development `.mcp.json` connection with the registered `.app.json` ID;
- verify the MCP domain and serve the OpenAI challenge response;
- provide publisher identity, logo, descriptions, support, privacy, and terms;
- provide five positive and three negative test prompts plus demo credentials;
- confirm tool annotations match actual read/write/external behavior.

OpenAI currently permits existing paid users to authenticate and use their
entitlements, but the plugin must not sell, initiate, or promote Score Studio
digital plans, credits, or subscriptions inside the plugin.

## Claude Code

Package: `plugins/claude/score-studio`; marketplace catalog:
`.claude-plugin/marketplace.json`.

Development:

```text
claude --plugin-dir ./plugins/claude/score-studio
```

Repository marketplace:

```text
/plugin marketplace add score-technologies/score-studio-agent-plugins
/plugin install score-studio@score-technologies
```

For the official marketplace, submit from Claude.ai or Anthropic Console after
the npm MCP package is public and the plugin passes a real-account smoke test.

## Gemini CLI

Package: `plugins/gemini/score-studio`.

```bash
gemini extensions validate ./plugins/gemini/score-studio
gemini extensions link ./plugins/gemini/score-studio
```

After the repository is public, release a matching version tag and add the
`gemini-cli-extension` GitHub topic so the gallery crawler can index it.

## Lovable

Lovable can consume Score Studio as a chat connector. Business and Enterprise
workspaces can add custom MCP servers; Lovable Desktop can also add a custom
local MCP command.

For local Desktop testing, use `node <repo>/dist/stdio.js` with
`SCORESTUDIO_TOKEN`; set `SCORESTUDIO_URL` only for a non-production API. For the
web product, connect the future hosted HTTPS `/mcp` endpoint through Connectors
→ Chat connectors. This gives Lovable Score Studio context and actions while
building an app; it does not embed Score Studio into the deployed app.

Lovable does not currently document a self-service third-party marketplace
submission comparable to Cursor, OpenAI, or Anthropic. Treat it as a connector
distribution channel and partnership opportunity.

## GitHub Copilot and VS Code

Use `.vscode/mcp.json` for a repository-local install:

```json
{
  "inputs": [
    { "id": "scorestudio-token", "type": "promptString", "description": "Score Studio token", "password": true }
  ],
  "servers": {
    "score-studio": {
      "command": "npx",
      "args": ["-y", "@score-technologies/score-studio-mcp"],
      "env": {
        "SCORESTUDIO_TOKEN": "${input:scorestudio-token}"
      }
    }
  }
}
```

Once hosted with OAuth, submit the remote server to the GitHub MCP Registry for
gallery discovery. Organization policy may need to enable MCP for Copilot.

## Cursor and other MCP hosts

Keep the existing Cursor Marketplace package for rules, commands, agents, and
skills, and add the shared remote MCP server once hosted.

Windsurf Cascade accepts stdio, Streamable HTTP, and OAuth MCP servers. Before
the hosted service exists, add the npm command to
`~/.codeium/windsurf/mcp_config.json`; after hosting, submit the HTTPS endpoint
to its MCP Marketplace and request the official-provider verification mark.

Other compatible clients connect to the same Streamable HTTP endpoint and
authenticate with OAuth; no forked business logic is required.
