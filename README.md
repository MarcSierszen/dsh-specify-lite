# @zhangqingyu/dsh-specify

A lean, DSH-only plugin for spec-driven development (SDD). It is inspired by GitHub Spec-Kit, but is an independent, incompatible workflow: it does not install or use Spec-Kit or any external SDD CLI.

## Install

```bash
dsh plugin --profile web add git+https://github.com/904915452/dsh-specify.git
```

The minimum tested DSH release is `0.1.1-rc.2`; Node.js 20 or newer is required. The bundled read-only helper is invoked through DSH's Bash tool.

## Commands

- `/speckit` — help, explicit initialization, and derived stage
- `/speckit-constitution` — optional project constraints
- `/speckit-specify` — create or revise a feature specification
- `/speckit-clarify` — resolve specification ambiguity
- `/speckit-plan` — produce a technical plan
- `/speckit-tasks` — produce an ordered task list
- `/speckit-analyze` — model-driven read-only quality review
- `/speckit-implement` — implement approved tasks

Start with `/speckit init`. Initialization creates only `.speckit/` and `specs/`, safely and idempotently.

## Layout

```text
.speckit/
└── constitution.md             # optional
specs/
└── 001-feature-slug/
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

Use `--feature 001-feature-slug`, a unique slug, or `specs/001-feature-slug` to select a feature. Feature identity never comes from a Git branch.

Tasks use stable `T001`-style IDs. Partial implementation accepts, for example, `--tasks T003,T005-T008`; selected work is ordered as it appears in `tasks.md`. Completed checkboxes and JSON verification records in `tasks.md` determine derived stages: `not-started`, `specified`, `planned`, `tasked`, `in-progress`, and `complete`. Completion requires every task complete plus a final full-scope passing verification record.

Artifact edits are explicit: existing artifacts are read, proposed, and confirmed before changes. `/speckit-implement` asks once before its selected source edits, checkbox updates, and verification record. It inspects project documentation and package scripts before choosing tests and asks if no test command is clear.

The plugin never mutates Git state: it does not create, switch, reset, stash, commit, merge, or rebase branches.

## Breaking redesign

Version 0.2.0 replaces the prior migrated workflow with the DSH-only three-artifact model above.

## Legacy artifacts from versions before 0.2.0

Migrate manually: move old feature directories into `specs/`, rename `specify.md` to `spec.md`, and move any constitution to `.speckit/constitution.md`. Discard unsupported brownfield or branch metadata. Do not create `status.json` or `checklist.md`.
