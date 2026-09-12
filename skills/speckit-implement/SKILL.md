---
name: speckit-implement
description: Safely implement a validated full or partial task selection and record exact verification evidence.
whenToUse: Use for /speckit-implement after valid specification, plan, and tasks artifacts exist.
---

# `/speckit-implement` — Implement selected tasks

## Resolve scope

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, obtain the absolute project root from the DSH session working directory, and invoke it through Bash:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper is read-only; never duplicate its feature, task, dependency, or validity logic. If guidance, Bash, or execution is unavailable, stop before writing. Run `features`; resolve `--feature` through `resolve-feature`, or select only the sole valid feature. Ask when ambiguous and report none when absent. Run `derive-stage --feature "<absolute-feature-path>"` and require valid `spec.md`, `plan.md`, and `tasks.md`.

Resolve work with `select-tasks --tasks "<absolute-tasks.md>"`; add `--selection "<value>"` for `--tasks T003,T005-T008`. Without it, select all incomplete tasks. Use returned document order, report already completed selections, and do not reimplement them unless explicitly requested. For incomplete dependencies, ask whether to include them or stop; never add them silently.

## Confirm before code edits

Read the three artifacts, optional constitution, and relevant repository files. Summarize selected tasks and approved prerequisites, intended files or areas, tests, and risks; ask once for confirmation. That confirmation authorizes only those source edits, matching checkbox updates, and verification evidence. New scope requires new confirmation.

## Implement and verify

- Never mutate Git state.
- Follow repository conventions and the approved plan; implement only authorized tasks.
- Mark a checkbox complete only after its work is implemented and appropriately verified. Leave unrelated tasks unchanged.
- Stop and surface any needed specification or plan change.
- Run relevant tests after logical phases when possible. Inspect documentation and package scripts before choosing commands; ask if unclear and never invent a command.
- Record every command actually run and no others.

Append a verification run under `## Verification` with a unique UTC ISO-8601 timestamp and exactly one fenced JSON object:

```json
{
  "scope": { "kind": "full", "tasks": [] },
  "overallResult": "pass",
  "checks": [
    { "command": "npm test", "exitCode": 0, "result": "pass" }
  ]
}
```

For partial work use `{"kind":"partial","tasks":[...]}` with unique selected task IDs expanded and in document order. Checks are non-empty; `result` is `pass` exactly for exit code `0`, and `overallResult` is `pass` only if all checks pass.

Before recording evidence, inspect the existing `## Verification` section:

- For the first verification run, replace the exact standalone sentence `No verification has been recorded.` with the complete verification-run heading and JSON block. Do not leave the placeholder in the file.
- When valid verification runs already exist, append the new run after the final existing block and preserve every earlier run.
- If the section contains the placeholder together with a run, malformed text, or invalid existing evidence, stop and direct the user to repair `tasks.md`; do not append another block.
- If no check ran, append nothing and leave the placeholder unchanged when it is still the only verification content.

After updating task checkboxes and evidence, run `derive-stage` again. If it reports `invalid`, repair the artifact before reporting implementation results. Preserve unrelated content.

Report changed files; completed, failed, blocked, and remaining tasks; and exact commands, exit codes, and results. Claim completion only when every task is checked and the final verification run is full and passing.
