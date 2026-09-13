# @marcsierszen/dsh-specify-lite

A lean, DSH-only plugin for spec-driven development (SDD). It was initially migrated from the `zhangqingyu/dsh-specify` project; it is now independently maintained as `dsh-specify-lite`. It is inspired by GitHub Spec-Kit, but is an independent, incompatible workflow: it does not install or use Spec-Kit or any external SDD CLI.

## Install

```bash
dsh plugin --profile web add git+https://github.com/MarcSierszen/dsh-specify-lite.git
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

## First steps: constitution and a health API

This example establishes project-wide principles first, then defines the API contract and implements its first endpoint.

From the root of a project:

```text
/speckit init
/speckit-constitution
```

When prompted for the project principles, enter:

```text
Use Python for the service. Design the API contract first. Follow RESTful API conventions.
```

Then create the first feature specification:

```text
/speckit-specify
```

When prompted for the feature, enter:

```text
Add a health endpoint: GET /health returns HTTP 200 and JSON {"status":"ok"}. The endpoint must not require authentication and should be suitable for automated health checks.
```

Then continue the delivery path:

```text
/speckit-plan
```

Ask for the smallest implementation that preserves the `/health` contract and follows the constitution. Then run:

```text
/speckit-tasks
/speckit-implement
```

The implementation should add the service and tests for `GET /health`, verify the `200` response and exact JSON body, and record the verification evidence in `tasks.md`. The resulting contract is:

```http
GET /health
Accept: application/json

200 OK
Content-Type: application/json

{"status":"ok"}
```

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

## Initial migration and current independence

This project began as an initial migration from `zhangqingyu/dsh-specify`, with credit to that starting point. The current `dsh-specify-lite` codebase is independently maintained and does not promise compatibility with the predecessor.

## Breaking redesign

Version 0.2.0 is the breaking redesign: it uses the DSH-only three-artifact model above.

## Legacy artifacts from versions before 0.2.0

Projects using older artifacts must migrate manually: move feature directories into `specs/`, rename `specify.md` to `spec.md`, and move any constitution to `.speckit/constitution.md`. Discard unsupported brownfield or branch metadata; do not create `status.json` or `checklist.md`.
