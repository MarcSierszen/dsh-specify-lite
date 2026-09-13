---
name: speckit
description: Explain, initialize, and report the derived stage of the DSH-only specification workflow.
whenToUse: Use for /speckit, explicit SDD initialization, workflow help, stage inspection, or next-step guidance.
---

# `/speckit` — Workflow hub

Use this DSH-only path:

`/speckit init` → `/speckit-constitution` (optional) → `/speckit-specify` → `/speckit-clarify` (optional) → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` (recommended) → `/speckit-implement`.

Artifacts are limited to `.speckit/constitution.md` and `specs/<NNN>-<slug>/{spec,plan,tasks}.md`. Do not install external SDD tools, create workflow state files, or mutate Git.

## Helper

Read the injected `Base directory for this skill`, resolve `scripts/speckit-helper.mjs` against that absolute directory, and obtain the absolute project root from the DSH session working directory. Invoke operations only through Bash:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper is read-only. Do not reproduce its parsers. If resource guidance, Bash, or helper execution is unavailable, stop before writing and report the blocker.

## Initialize

Initialize only for `/speckit init` or an equally explicit initialization request; a help invocation never initializes.

1. Run `init-plan`. Report `.speckit` and `specs` as missing, existing directories, or conflicts.
2. If either conflicts, create neither and explain the repair needed.
3. Otherwise, immediately before the first write, run `init-plan` again. Abort if its classification changed to a conflict.
4. Create only missing `.speckit/` and `specs/` directories; preserve existing directories. Never create an empty constitution or initialize Git.
5. If a later creation loses a race, stop, report any partial safe creation, and delete nothing. Report created, existing, and conflicting paths separately.

## Stage and next step

For a stage request, run `init-plan` first. If `.speckit/` or `specs/` is missing, report exactly: `Not initialized. Run /speckit init.` If either path is a file, symlink, unreadable, or otherwise conflicting, report the helper diagnostic and stop.

Only after initialization passes, run `features`. With `--feature`, resolve it through `resolve-feature`; without it, select only when exactly one valid feature exists, ask when several exist, and report none when there are none. Never select from Git, environment, recency, or a guess. Run `derive-stage` for the resolved feature.

Report helper diagnostics and one of `invalid`, `not-started`, `specified`, `planned`, `tasked`, `in-progress`, or `complete`; do not use percentages. For `invalid`, recommend repair of the earliest invalid or missing artifact. Otherwise recommend the next valid command. `complete` requires all tasks checked and the final verification run to be full and passing—not artifact existence alone.
