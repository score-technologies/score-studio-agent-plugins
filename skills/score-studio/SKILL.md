---
name: score-studio
description: Give Hermes Agent sight with Score Studio. Inspect versioned vision data, train and evaluate models, review evidence, run workflows, and verify deployments through MCP.
version: 0.2.0
author: Score Technologies
license: Apache-2.0
metadata:
  hermes:
    tags: [computer-vision, mlops, datasets, training, evaluation, deployment, mcp]
    category: mlops
required_environment_variables:
  - name: SCORESTUDIO_TOKEN
    prompt: Score Studio bearer token or API key
    required_for: authenticated Score Studio MCP tools
---

# Score Studio

Use this skill when a user asks Hermes Agent to operate Score Studio or manage
an evidence-backed computer-vision lifecycle.

## Prerequisites

The `score-studio` MCP server must be configured in Hermes. Its tools are
discovered at startup and receive an `mcp_` prefix. Use the configured
Score Studio tools rather than making undocumented HTTP requests.

## Procedure

1. Resolve identity and organization membership before accessing scoped data.
2. Inspect datasets, models, evaluations, workflows, and deployments before
   mutating them. Never guess an identifier.
3. Pin immutable dataset and model versions for training and evaluation.
4. Explain compute cost or external effects before starting durable work.
5. Preserve returned job, model-version, evaluation-run, and deployment IDs.
6. Compare evaluation evidence only when purpose, dataset version, class
   mapping, metric configuration, and evaluator revision are compatible.
7. Report preview mode and deferred workflow blocks truthfully.
8. Verify the active deployment and retain its health evidence before calling
   it production-ready.

## Useful sequences

- Readiness audit: identity → datasets → models → evaluations → report →
  deployments → verification.
- Training: exact dataset version → compute confirmation → training job →
  durable model-version identifier.
- Evaluation: exact model and dataset versions → evaluation run → immutable
  report and acceptance decision.
- Workflow: workflow definition → input and side-effect confirmation → run →
  executed-versus-deferred summary.

## Security

Never display, log, or persist the Score Studio token. Do not expose private
media, signed URLs, provider credentials, or customer evidence outside the
authorized organization.

## Verification

Confirm Hermes discovers the Score Studio MCP tools with
`hermes mcp test score-studio`. A valid setup returns the tool inventory without
printing the configured token.
