---
name: speckit-analyze
description: Perform a model-driven, read-only semantic review of a feature's specification, plan, tasks, and constraints.
whenToUse: Use for /speckit-analyze as a quality gate before implementation or when traceability and consistency need review.
---

# `/speckit-analyze` — Semantic quality gate

This command reports in chat only. Do not create or append a report and do not edit artifacts unless the user separately asks to apply selected fixes.

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, obtain the absolute project root from the DSH session working directory, and invoke it through Bash:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper supplies mechanical checks only. If guidance, Bash, or execution is unavailable, stop and report the blocker. Run `features`; resolve `--feature` through `resolve-feature`, or select only the sole valid feature. Ask when ambiguous and report none when absent. Run `derive-stage --feature "<absolute-feature-path>"`; require valid `spec.md`, `plan.md`, and `tasks.md`, and report structural diagnostics. Direct an uninitialized project to `/speckit init`.

Read all three artifacts, optional `.speckit/constitution.md`, and relevant repository code/configuration when needed to validate claims. Perform the semantic analysis yourself—do not run a canned analyzer or equate string matching with coverage.

Check uncovered requirements, unverifiable success criteria, unhandled edge cases, contradictions, ambiguity, scope leakage, weak tests, unclear/oversized/unordered tasks, dependency problems, constitution violations, missing integration details, and repository claims unsupported by observed evidence.

Report exactly these sections:

1. `## Verdict`: `PASS`, `NEEDS CHANGES`, or `BLOCKED`.
2. `## Findings`: stable finding IDs, severity (`error`, `warning`, or `note`), evidence, and affected artifact IDs.
3. `## Traceability`: cover every `FR-*`, `SC-*`, and `EC-*`.
4. `## Recommended Fixes`: order fixes by impact.

Do not mutate Git. Recommend selected fixes or `/speckit-implement` as appropriate.
