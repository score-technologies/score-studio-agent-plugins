# Score Studio for Cursor

## Give your agents sight.

Score Studio is the computer vision layer for agents, automating data
generation, annotation, training, evaluation, workflows, and deployment in one
evidence-backed system.

This package gives Cursor the Score Studio operating skill and the shared MCP
tool server. Install it from the repository marketplace, then set the required
`SCORESTUDIO_TOKEN` variable in Cursor's plugin configuration. The MCP server
defaults to `https://api.scorestudio.ai`; set `SCORESTUDIO_URL` in the MCP
environment only for a custom, staging, self-hosted, or local API.

The standalone `score-studio-cursor-plugin` repository remains available for
the existing Cursor Marketplace listing. This package is the consolidated copy
distributed with the other agent integrations.
