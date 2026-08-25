---
name: score-studio
description: Use Score Studio to inspect versioned computer-vision data and models, start training or evaluation, review evidence, verify deployments, and run workflows. Trigger for Score Studio datasets, CV training, evaluation gates, model release evidence, deployments, or visual workflows.
---

# Score Studio

Use the `scorestudio_*` tools to operate Score Studio. Start with
`scorestudio_whoami` when the organization is unknown.

## Operating rules

1. Inspect before mutating. Resolve the organization, dataset version, model
   version, evaluation run, workflow, or deployment rather than guessing an ID.
2. Explain cost or external effects before starting training, evaluation, or a
   workflow run. Preserve returned durable identifiers.
3. Treat dataset and model versions as immutable provenance. Never silently
   substitute a newer version.
4. Compare evaluation runs only when task, dataset version, class mapping,
   metric configuration, and evaluation purpose are compatible.
5. Release claims require measured evaluation evidence. A successful training
   task or artifact export is not proof of improvement.
6. A workflow response may contain deferred blocks. Report its execution mode
   and deferred work instead of describing preview as production completion.
7. Verify a deployment and retain the returned health evidence before calling
   it production-ready.
8. Do not expose access tokens, private media, provider credentials, signed
   URLs, or raw secrets in chat or logs.

## Useful sequences

- Audit readiness: list datasets → inspect models → list evaluations → fetch
  the chosen report → list and verify deployments.
- Train: inspect the dataset/version → explain compute choice → start training
  → return the durable model/version identifier.
- Evaluate: resolve exact model and dataset version IDs → start evaluation →
  later fetch the immutable report.
- Workflow: list workflows → confirm the input object key and side effects →
  run → distinguish executed from deferred blocks.
