---
name: speckit-clarify
description: Resolve consequential ambiguity in an existing feature specification without changing unrelated scope.
whenToUse: Use for /speckit-clarify when a selected specification has conflicts, vague outcomes, missing edge cases, or open questions.
---

# `/speckit-clarify` — Resolve ambiguity

## Resolve safely

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, obtain the absolute project root from the DSH session working directory, and invoke it through Bash:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper is read-only. If resource guidance, Bash, or execution is unavailable, stop before writing. Run `features`; use `resolve-feature --selector "<value>"` for `--feature`. Without a selector, resolve the sole valid feature, ask the user to choose among several, or report that none exists. Never infer from Git, environment, recency, or conversation. Require an existing mechanically valid `spec.md`; use `derive-stage --feature "<absolute-feature-path>"` and report structural diagnostics. Direct an uninitialized project to `/speckit init`.

## Clarify

Read `spec.md`. Identify ambiguity, conflicts, missing edge cases, unmeasurable criteria, and blocking questions. Do not ask for repository facts that can be reliably observed. Ask one focused batch of consequential questions.

After answers arrive, those answers authorize incorporating exactly those decisions. Request separate confirmation for unrelated scope expansion. Preserve unrelated content and stable `US-*`, `FR-*`, `SC-*`, `EC-*`, and `OQ-*` identifiers; do not renumber merely to close gaps. If no meaningful ambiguity exists, report that and make no edit.

Read an existing artifact before modification. Stop on a wrong-type, symlinked, unreadable, unsafe, or conflicting path. Never silently overwrite content or mutate Git. Summarize approved changes and recommend `/speckit-plan` once no blocking question remains.
