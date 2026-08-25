# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/score-technologies/score-studio-agent-plugins/security/advisories/new). Do not disclose credentials, customer data, or exploit details in a public issue.

## Public-release boundary

This repository contains only the public MCP interface and agent packages. It
must not contain private source-repository identifiers, private source commit
identifiers, local filesystem paths, credentials, customer data, or symlinks.
The release validator enforces this boundary.

The MCP server accepts Score Studio credentials only at runtime, forwards them
to the configured Score Studio API, and does not persist them. Operators should
use HTTPS endpoints, short-lived or scoped credentials, and platform-managed
secrets.
