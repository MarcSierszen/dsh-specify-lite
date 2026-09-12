---
name: speckit-tasks
description: Produce a structurally exact, traceable, dependency-ordered task list from a valid specification and plan.
whenToUse: Use for /speckit-tasks when specs/<feature>/tasks.md should be created or safely repaired.
---

# `/speckit-tasks` — Task breakdown

## Resolve and validate

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, obtain the absolute project root from the DSH session working directory, and invoke it through Bash:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper is read-only. If guidance, Bash, or execution is unavailable, stop before writing. Run `features`; resolve `--feature` through `resolve-feature`, or use only the sole valid feature. Ask when ambiguous and report none when absent. Run `derive-stage --feature "<absolute-feature-path>"`; require valid `spec.md` and `plan.md`. Direct an uninitialized project to `/speckit init`.

Create at least one small, imperative, independently verifiable task. Cover every `FR-*` and `SC-*`, relevant `EC-*`, tests, and documentation. Map each task to at least one identifier or explicitly mark it `[FOUNDATION]`. Identify gaps rather than inventing work outside the plan. Order prerequisites before dependents. If no implementation or verification task can be derived, stop and ask the user to revisit scope or plan.

## Exact structure

```markdown
# Tasks: <name>

## Task List

- [ ] T001 [FR-001] Add the configuration model
- [ ] T002 [FR-001, SC-001] Test configuration validation (depends: T001)

## Verification

No verification has been recorded.
```

Task IDs are stable, unique `T` plus at least three digits. References are uppercase `FR-*`, `SC-*`, or `EC-*`. Dependencies use exactly `(depends: T001, T002)`; omit the suffix when empty. Do not create duplicate, unknown, self, later-task, or cyclic dependencies. Only `- [ ]` and `- [x]` are valid checkbox states; under `## Task List`, task-like lines must follow this form. Preserve existing checkbox truth and never renumber unaffected tasks.

Explicit invocation authorizes creation of missing `tasks.md`. For an existing valid file, read it and confirm proposed changes unless already authorized. If structurally invalid, report helper diagnostics and offer a repair; replace malformed content only after explicit confirmation, retaining unrelated readable content where safe. Stop on wrong-type, symlinked, unreadable, unsafe, or conflicting paths. Never mutate Git.

Summarize coverage, dependencies, and gaps; recommend `/speckit-analyze`, then `/speckit-implement`.
