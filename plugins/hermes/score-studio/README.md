# Score Studio for Hermes Agent

Hermes Agent consumes Score Studio through a native skill tap and its built-in
MCP client.

## Install the skill

```bash
hermes skills tap add score-technologies/score-studio-agent-plugins
hermes skills install score-technologies/score-studio-agent-plugins/score-studio
```

Hermes prompts securely for `SCORESTUDIO_TOKEN` when the skill first loads and
stores it in `~/.hermes/.env`, outside the repository and model context.

## Configure the MCP server

Merge [`config.example.yaml`](config.example.yaml) into
`~/.hermes/config.yaml`, then run:

```bash
hermes mcp test score-studio
```

The package defaults to `https://api.scorestudio.ai`. To use a custom,
staging, self-hosted, or local Score Studio API, add `SCORESTUDIO_URL` to the
server's `env` map and define it in `~/.hermes/.env`.
