# AI Instructions: Refactor `dsh-specify-lite` into a Lean DSH-Only SDD Plugin

## Objective

Refactor this repository into `dsh-specify-lite`, a small, reliable, DSH-exclusive Spec-Driven Development (SDD) plugin.

The result is an independent project inspired by GitHub Spec-Kit. It is not a compatible implementation, extension, or runtime distribution of GitHub Spec-Kit.

Optimize for:

1. one understandable SDD path;
2. safe and explicit artifact changes;
3. deterministic feature and task mechanics;
4. concise, self-contained skills;
5. minimal runtime and packaging complexity.

Prefer deletion over compatibility layers or speculative features.

The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## 1. Product boundaries

The plugin MUST NOT depend on or instruct users to install or use:

- GitHub Spec-Kit at runtime;
- `specify-cli` or any external SDD CLI;
- `uv` or `uvx`;
- Claude Code or another non-DSH harness;
- `.claude/commands` or another agent integration;
- upstream Spec-Kit templates or branch extensions;
- Git branches for feature identity or selection.

The plugin MUST NOT provide:

- a special brownfield mode;
- reverse engineering or documentation backfill;
- integration-planning commands separate from normal planning;
- migration, coverage-check, traceability, validation-report, converge, or task-to-issue commands;
- automatic Git branch or commit management.

The normal SDD workflow MAY be used to add new work to either a new or an existing repository. “No brownfield mode” means there is no separate reverse-engineering workflow; it does not prohibit inspecting an existing repository while planning a new change.

The plugin MUST NOT run Git commands that create, switch, reset, stash, commit, merge, rebase, or otherwise mutate Git state. Read-only Git inspection is allowed only when genuinely useful and MUST NOT determine the selected feature.

## 2. Exact command surface

Register exactly these eight DSH skills, all user-invocable and model-invocable:

- `/speckit`
- `/speckit-constitution`
- `/speckit-specify`
- `/speckit-clarify`
- `/speckit-plan`
- `/speckit-tasks`
- `/speckit-analyze`
- `/speckit-implement`

All command names and references MUST use kebab-case. Dot-style names such as `/speckit.plan` are invalid.

Remove the existing `/speckit-checklist` and `/speckit-status` skills. Checklist concerns belong in the specification, task list, and `/speckit-analyze`. Workflow status is derived and shown by `/speckit`; it is not a separate command or persistent state file.

The intended path is:

```text
/speckit init
    ↓
/speckit-constitution       optional project-wide constraint
    ↓
/speckit-specify
    ↓
/speckit-clarify            optional when ambiguity exists
    ↓
/speckit-plan
    ↓
/speckit-tasks
    ↓
/speckit-analyze            optional but recommended quality gate
    ↓
/speckit-implement
```

## 3. Exact artifact contract

Use only this SDD layout:

```text
.speckit/
└── constitution.md          # optional project-wide constraints

specs/
└── 001-feature-slug/
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

Rules:

- Multiple feature directories are supported.
- Feature directories are direct children of `specs/`.
- Feature directories MUST match `^[0-9]{3,}-[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Feature slugs use lowercase ASCII kebab-case.
- The numeric prefix is at least three digits and MAY grow beyond three digits.
- Do not create `status.json`, `checklist.md`, `specify.md`, `.speckit/features/`, or implementation-code copies under a feature directory.
- The plugin generates only the three named feature artifacts. Pre-existing additional regular files or directories inside a feature directory are reported as unrecognized, preserved, and otherwise ignored. They MUST NOT be deleted, rewritten, or treated as workflow state.
- A symlink occupying `spec.md`, `plan.md`, or `tasks.md` is an unsafe artifact conflict and stops the command.
- `/speckit-analyze` reports in chat only. It MUST NOT create or append a report artifact.
- Verification evidence is recorded in the `Verification` section of `tasks.md`.

## 4. Stable document identifiers and formats

Use these identifiers:

- user stories: `US-001`, `US-002`, …;
- functional requirements: `FR-001`, `FR-002`, …;
- success criteria: `SC-001`, `SC-002`, …;
- edge cases: `EC-001`, `EC-002`, …;
- open questions: `OQ-001`, `OQ-002`, …;
- tasks: `T001`, `T002`, ….

Identifiers MUST remain stable when an existing artifact is revised. Do not renumber unaffected entries merely to close gaps.

### Required `spec.md` sections

Use these headings in this order:

1. `# Feature: <name>`
2. `## Problem`
3. `## Goals`
4. `## User Stories`
5. `## Functional Requirements`
6. `## Success Criteria`
7. `## Edge Cases`
8. `## Out of Scope`
9. `## Assumptions`
10. `## Open Questions`

Each functional requirement and success criterion MUST be independently checkable. Implementation technologies, frameworks, libraries, schemas, and file-level design do not belong in `spec.md` unless they are explicit product constraints supplied by the user.

Mark unresolved blocking questions as:

```markdown
- [BLOCKING] OQ-001: <question>
```

Mark non-blocking questions as:

```markdown
- [NON-BLOCKING] OQ-002: <question>
```

Planning MUST stop while a blocking open question remains unresolved.

### Required `plan.md` sections

Use these headings in this order:

1. `# Plan: <name>`
2. `## Technical Context`
3. `## Constraints from Constitution and Specification`
4. `## Architecture and Components`
5. `## Data Flow and Interfaces`
6. `## Dependencies`
7. `## Requirement Mapping`
8. `## Testing Strategy`
9. `## Risks and Fallbacks`

The requirement mapping MUST reference the relevant `FR-*`, `SC-*`, and, where applicable, `EC-*` identifiers.

### Required `tasks.md` structure

Use:

```markdown
# Tasks: <name>

## Task List

- [ ] T001 [FR-001] Add the configuration model
- [ ] T002 [FR-001, SC-001] Test configuration validation (depends: T001)

## Verification

No verification has been recorded.
```

Task rules:

- Every task ID matches `^T[0-9]{3,}$`; IDs above `T999` are valid.
- Every requirement, criterion, and edge-case reference uses its defined uppercase prefix followed by at least three digits.
- Task IDs are unique. Duplicate IDs are structural errors.
- Every implementation or verification task maps to at least one `FR-*`, `SC-*`, or `EC-*` identifier unless it is explicitly marked `[FOUNDATION]`.
- Dependencies use the exact suffix `(depends: T001, T002)`.
- Omit the dependency suffix when there are no task dependencies.
- Duplicate dependencies, unknown dependency IDs, self-dependencies, cycles, and dependencies on later tasks are structural errors.
- Under `## Task List`, blank lines, Markdown comments, and `### <phase>` headings are allowed. Every line beginning with `- [` MUST otherwise match the defined task form exactly; `[X]`, `[~]`, and other checkbox states are invalid.
- Tasks are imperative, small, ordered, and independently verifiable.
- Tasks MUST include necessary tests and documentation rather than deferring all quality work to an optional checklist.
- Existing checkboxes are the task-completion source of truth.

Verification runs are appended under `## Verification` using an exact JSON record so arbitrary shell commands remain unambiguous:

````markdown
### Verification Run: 2026-01-01T00:00:00Z

```json
{
  "scope": { "kind": "full", "tasks": [] },
  "overallResult": "pass",
  "checks": [
    { "command": "npm test", "exitCode": 0, "result": "pass" },
    { "command": "npm run lint", "exitCode": 0, "result": "pass" }
  ]
}
```
````

For partial implementation use `{ "kind": "partial", "tasks": ["T003", "T005", "T006", "T007", "T008"] }`; store canonical expanded task IDs rather than ranges. The task IDs must be unique, exist in `## Task List`, and equal the selected implementation scope in document order.

A run MUST contain a unique valid UTC ISO-8601 timestamp and exactly one fenced `json` object. The object allows exactly `scope`, `overallResult`, and `checks`; each check allows exactly `command`, `exitCode`, and `result`. `tasks` must be empty for `full` and non-empty for `partial`. `command` is a non-empty JSON string, `exitCode` is an integer, and `result` is `pass` exactly when `exitCode` is `0`, otherwise `fail`. `checks` must be non-empty. `overallResult` is `pass` only when every check passed; otherwise it is `fail`.

Verification blocks are ordered by their position in the document; the final block is the latest even if timestamps are out of order. Duplicate timestamps, unknown fields, invalid scope tasks, extra text inside a run, invalid JSON, or inconsistent results make verification evidence structurally invalid. Record every command actually run and never record a command that was not executed.

### Mechanical artifact validity

The helper uses structural validity only; it does not judge semantic quality.

A core artifact is mechanically valid only when it is a readable UTF-8 regular file, is not a symlink, contains each required heading exactly once in the required order, and has no duplicate machine identifiers.

Additional predicates are:

- `spec.md` contains at least one unique `FR-*` and one unique `SC-*`; all `US-*`, `FR-*`, `SC-*`, `EC-*`, and `OQ-*` tokens use the defined syntax.
- `plan.md` has the required headings. Identifier tokens in `## Requirement Mapping` use the defined syntax; semantic coverage is left to `/speckit-analyze`.
- `tasks.md` contains exactly one `## Task List`, exactly one `## Verification`, at least one valid task, no task/dependency structural error, and either the exact no-evidence sentence or one or more valid verification blocks—not both.
- A malformed verification section makes `tasks.md` mechanically invalid.

## 5. Initialization

The canonical initialization request is:

```text
/speckit init
```

Natural-language requests that clearly and explicitly ask `/speckit` to initialize MAY be treated equivalently. Merely invoking `/speckit` for help MUST NOT initialize anything.

Initialization creates only these missing directories:

```text
.speckit/
specs/
```

Initialization MUST:

- run the helper’s read-only initialization plan first;
- classify a regular real directory as existing, a missing path as missing, and a file, symlink, or other filesystem object as a conflict;
- report the classification of both paths even when one conflicts;
- create neither path when either path is a conflict;
- when there are no conflicts, create every missing path and leave every existing directory unchanged;
- re-run the plan immediately before the first write and abort before writing if the result changed to a conflict;
- if an external race causes a later creation to fail after an earlier directory was created, stop and report the partial result without deleting the safely created directory;
- never create an empty constitution;
- never overwrite a file or directory;
- report created, already-existing, and conflicting paths separately;
- be idempotent;
- not initialize or mutate Git;
- not install software, templates, CLIs, or agent integrations.

Every artifact-producing command requires `.speckit/` and `specs/` to exist as real directories. If either is missing or conflicting, the command stops and tells the user to run or repair `/speckit init`; no other command initializes implicitly.

## 6. Feature allocation and selection

### New feature allocation

For a new feature:

1. Inspect direct children of `specs/` using the bundled helper.
2. Consider only valid feature-directory names.
3. Parse prefixes as non-negative safe integers. A prefix above `Number.MAX_SAFE_INTEGER` is malformed. Compute the next number as the highest valid prefix plus one; use `001` when none exist and fail if incrementing would exceed the safe-integer limit.
4. Format with at least three digits.
5. Derive an ASCII lowercase kebab-case slug and show it in the proposed artifact path. If normalization produces an empty or misleading slug, ask the user to supply one.
6. Re-scan immediately before creation.
7. If the proposed path now exists, recompute once; if a collision remains, stop and report it.

Malformed direct children are ignored for allocation and returned as diagnostics. Symlinked feature directories are not valid candidates.

No cross-process lock is required, but the re-scan and collision behavior above is required.

### Feature selectors

`/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, and `/speckit-implement` are feature-specific and accept:

```text
--feature <selector>
```

`/speckit` MAY accept the same selector when showing one feature’s derived stage. `/speckit-specify` accepts it only for an explicit revision of an existing specification. `/speckit-constitution` does not accept it.

Accepted selectors are:

1. the exact directory basename, such as `001-user-login`;
2. a unique slug, such as `user-login`;
3. a project-relative path, such as `specs/001-user-login`.

Selectors MUST reject:

- absolute paths;
- `..` traversal;
- paths outside the project’s real `specs/` directory;
- symlink escapes;
- nonexistent feature directories;
- malformed feature-directory names.

A selector that matches nothing is an error. A slug that matches more than one feature is ambiguous and requires the user to choose.

When `--feature` is omitted:

- select the feature automatically only if exactly one valid feature exists;
- ask the user when multiple valid features exist;
- report that no feature exists when none exists.

Never infer the feature from a Git branch, environment variable, most-recent modification time, or conversational guess.

`/speckit-specify` without `--feature` creates a new feature. With an explicit existing `--feature`, it proposes a revision to that feature’s `spec.md` and follows existing-artifact confirmation rules; it MUST NOT silently replace the specification.

## 7. Partial task selection

The canonical form is:

```text
/speckit-implement --feature 001-user-login --tasks T003,T005-T008
```

Rules:

- Accept comma-separated task IDs and inclusive ascending ranges.
- Reject unknown IDs, malformed IDs, and reversed ranges.
- Deduplicate overlapping selections.
- Execute selected tasks in their order in `tasks.md`, not argument order.
- Identify incomplete dependencies before requesting implementation confirmation.
- Do not silently add dependencies. Ask whether to include missing prerequisites or stop.
- Completed dependencies do not need to be selected again.
- Without `--tasks`, select all incomplete tasks.
- Leave unrelated tasks and checkboxes unchanged.
- Mark a checkbox complete only after its task is implemented and appropriately verified.

## 8. Command behavior

### `/speckit`

The hub MUST:

- explain the concise workflow and command list;
- initialize only through an explicit initialization request;
- show derived project or feature stage when asked;
- recommend the next valid step;
- never advertise removed commands or upstream tooling.

The helper derives stages with this precedence:

1. `invalid`: a present core artifact is mechanically invalid, or a later artifact exists while a required earlier artifact is missing.
2. `not-started`: no core artifact exists.
3. `specified`: valid `spec.md` exists and neither `plan.md` nor `tasks.md` exists.
4. `planned`: valid `spec.md` and `plan.md` exist and `tasks.md` does not exist.
5. `tasked`: all three artifacts are valid, no task is completed, and no verification run exists.
6. `complete`: at least one task exists, all tasks are completed, and the final verification block in document order has `scope.kind` equal to `full`, has `overallResult` equal to `pass`, contains at least one check, and records every check as passing.
7. `in-progress`: all three artifacts are valid and at least one task is completed or verification evidence exists, but the `complete` predicate is false.

A later partial or failing run therefore prevents `complete` until a new full passing run is appended. Older failed runs do not prevent completion when the final run is full and passing. Unrecognized extra files do not affect the stage. When the stage is `invalid`, `/speckit` reports the helper’s structural diagnostics and recommends the command responsible for repairing the earliest invalid or missing artifact; it MUST NOT guess a later stage. Do not use percentages. Do not report `complete` based only on artifact existence or checkboxes.

### `/speckit-constitution`

The skill MUST:

- ask for project principles and constraints;
- create `.speckit/constitution.md` when missing;
- keep principles concrete and checkable;
- avoid imposing irrelevant categories;
- read and preserve existing content;
- propose and confirm updates to an existing constitution.

### `/speckit-specify`

The skill MUST:

- require a feature description;
- ask about splitting only when the request appears to contain independently deliverable features;
- allocate a feature through the helper when creating a new feature;
- create the required `spec.md` structure;
- keep the document focused on WHAT and WHY;
- expose assumptions and unresolved decisions rather than inventing product choices;
- summarize the created or approved revision and recommend clarification or planning.

### `/speckit-clarify`

The skill MUST:

- resolve the selected feature safely;
- require an existing `spec.md`;
- identify ambiguity, conflicts, missing edge cases, unmeasurable criteria, and blocking questions;
- ask one focused batch of questions;
- avoid asking for facts that can be reliably observed in the repository;
- update only after receiving answers;
- treat those answers as authorization for incorporating those exact decisions;
- request separate confirmation for unrelated scope expansion;
- preserve stable identifiers and unrelated content.

If no meaningful ambiguity exists, report that and make no edit.

### `/speckit-plan`

The skill MUST:

- require a valid `spec.md` and no unresolved blocking question;
- inspect `.speckit/constitution.md` when present;
- inspect relevant repository conventions before proposing architecture;
- infer routine technical details from the repository;
- ask only about consequential architecture or product choices;
- create the required `plan.md` structure;
- map the plan to specification identifiers;
- include tests, integration details, risks, and fallbacks;
- avoid out-of-scope work.

### `/speckit-tasks`

The skill MUST:

- require valid `spec.md` and `plan.md`;
- create the required `tasks.md` structure with at least one task;
- stop and ask the user to revisit feature scope or the plan if no implementation or verification task can be derived;
- when an existing `tasks.md` is structurally invalid, report the helper diagnostics and offer a proposed repair; replace malformed content only after explicit confirmation, preserving any unrelated readable content that can be retained safely;
- use stable IDs and exact dependency syntax;
- cover all functional requirements and success criteria;
- include relevant edge-case handling and verification;
- order dependencies before dependents;
- identify uncovered requirements rather than inventing tasks outside the plan.

### `/speckit-analyze`

This is a model-driven, read-only review. It MUST NOT run a canned analyzer or treat string matching as semantic validation.

Inspect:

- `spec.md`;
- `plan.md`;
- `tasks.md`;
- optional `.speckit/constitution.md`;
- relevant repository code and configuration when needed to validate claims.

Report using:

1. `## Verdict` with `PASS`, `NEEDS CHANGES`, or `BLOCKED`;
2. `## Findings`, with stable finding IDs, severity (`error`, `warning`, or `note`), evidence, and affected artifact IDs;
3. `## Traceability`, covering every `FR-*`, `SC-*`, and `EC-*`;
4. `## Recommended Fixes`, ordered by impact.

Check for:

- uncovered requirements;
- success criteria without verification;
- edge cases without handling;
- contradictions and ambiguous wording;
- accidental out-of-scope work;
- missing or inadequate tests;
- unclear, oversized, unordered, or dependency-invalid tasks;
- constitution violations;
- missing integration details;
- repository claims unsupported by observed evidence.

Do not edit artifacts unless the user separately asks to apply selected fixes.

### `/speckit-implement`

Before editing code, the skill MUST:

- require valid `spec.md`, `plan.md`, and `tasks.md`;
- resolve and validate the selected task set through the helper;
- identify incomplete dependencies;
- summarize intended files or areas, tasks, tests, and risks;
- ask once for confirmation.

That confirmation authorizes the selected source edits, their task-checkbox updates, and their verification records. New scope requires new confirmation.

During implementation, the skill MUST:

- never mutate Git state;
- follow repository conventions and the approved plan;
- implement only selected tasks and approved prerequisites;
- update a checkbox only after completing the corresponding work;
- stop and surface any required specification or plan change;
- run relevant tests after logical phases when possible;
- inspect documentation and package scripts before selecting test commands;
- ask when the test command is unclear;
- never invent a test command.

After implementation, the skill MUST:

- append exact verification evidence to `tasks.md`;
- report changed files;
- report completed, failed, blocked, and remaining tasks;
- report exact commands, exit codes, and results;
- avoid claiming complete unless all tasks and full-scope passing evidence satisfy the derived-stage contract.

## 9. Write authorization and safety

For artifact changes:

- Explicit invocation authorizes creation of a missing artifact requested by that command.
- An existing artifact MUST be read before modification.
- Before changing an existing artifact, explain the proposed changes and obtain confirmation unless the user already authorized those exact changes.
- Clarification answers authorize incorporation of those exact answers.
- Implementation confirmation authorizes only the selected implementation scope, matching task checkboxes, and verification evidence.
- Preserve unrelated content and stable identifiers.
- Use atomic writes where the available DSH file tools support them.
- Never silently overwrite, truncate, or replace an existing artifact.

If a path has the wrong type, is unreadable, escapes the project, or conflicts with the artifact contract, stop and report the problem.

## 10. Bundled deterministic helper

Add a small internal helper library for mechanical operations only. It is not a user-facing CLI and requires no installation.

Use:

```text
lib/workflow.js
skills/scripts/speckit-helper.mjs
```

`lib/workflow.js` contains reusable, independently tested logic. `skills/scripts/speckit-helper.mjs` is a thin JSON CLI wrapper used by retained skills through their DSH resource base. Skills MUST invoke the resolved absolute helper resource path and pass the target project root explicitly; they MUST NOT assume the target project contains a copy of this plugin.

The helper MUST be read-only. Artifact and source writes remain visible DSH model actions governed by the write-safety rules.

Required helper operations:

```text
init-plan       --project-root <path>
features        --project-root <path>
resolve-feature --project-root <path> --selector <value>
select-tasks    --project-root <path> --tasks <path> [--selection <value>]
derive-stage    --project-root <path> --feature <path>
```

Every operation writes exactly one JSON object followed by a newline to stdout. Warnings and errors are additionally written to stderr as one line per item in `<CODE>: <message>` form. Successful operations, including success with warnings, exit `0`; usage or selection errors exit `2`; unsafe paths exit `3`; malformed projects or artifacts exit `4`; unexpected failures exit `1`. `init-plan` returns success with `canInitialize: false` and a `PROJECT_CONFLICT` warning when either target conflicts, because classifying that state is the operation’s intended result. Other operations treat an unusable required project path as a `PROJECT_CONFLICT` error with exit `4`.

Every response uses one of these envelopes:

```json
{
  "ok": true,
  "operation": "features",
  "data": {},
  "diagnostics": [
    { "level": "warning", "code": "MALFORMED_FEATURE", "path": "/absolute/path", "message": "reason" }
  ]
}
```

```json
{
  "ok": false,
  "operation": "resolve-feature",
  "error": {
    "code": "AMBIGUOUS",
    "message": "human-readable explanation",
    "details": {}
  },
  "diagnostics": []
}
```

Allowed error codes are `INVALID_ARGUMENT`, `UNSAFE_PATH`, `PROJECT_CONFLICT`, `NOT_FOUND`, `AMBIGUOUS`, `MALFORMED_FEATURE`, `MALFORMED_ARTIFACT`, `INVALID_SELECTION`, and `UNEXPECTED`. Paths returned in data are absolute canonical real paths, except a missing initialization target, which is an absolute normalized path directly beneath the canonical project root.

Operation data shapes are normative:

```js
// init-plan
data = {
  projectRoot: string,
  canInitialize: boolean,
  paths: {
    ".speckit": { path: string, state: "missing" | "directory" | "conflict", type: string | null },
    "specs": { path: string, state: "missing" | "directory" | "conflict", type: string | null }
  }
}

// features
data = {
  projectRoot: string,
  specsRoot: string,
  features: Array<{ name: string, number: number, prefix: string, slug: string, path: string }>,
  malformed: Array<{ name: string, path: string, reason: string }>,
  nextNumber: number,
  nextPrefix: string
}

// resolve-feature
data = {
  projectRoot: string,
  specsRoot: string,
  selector: string,
  feature: { name: string, number: number, prefix: string, slug: string, path: string }
}

// select-tasks
data = {
  projectRoot: string,
  tasksFile: string,
  requested: string | null,
  selected: Array<{
    id: string,
    checked: boolean,
    references: string[],
    dependencies: string[],
    line: number,
    text: string
  }>,
  incompleteDependencies: Array<{ task: string, dependency: string }>
}

// derive-stage
data = {
  projectRoot: string,
  feature: string,
  stage: "invalid" | "not-started" | "specified" | "planned" | "tasked" | "in-progress" | "complete",
  artifacts: {
    spec: { path: string, state: "missing" | "valid" | "invalid" },
    plan: { path: string, state: "missing" | "valid" | "invalid" },
    tasks: { path: string, state: "missing" | "valid" | "invalid" }
  },
  tasks: { total: number, completed: number, remaining: number } | null,
  latestVerification: {
    timestamp: string,
    scope: { kind: "full" | "partial", tasks: string[] },
    overallResult: "pass" | "fail",
    checks: number
  } | null
}
```

The implementation MAY add fields only in a future breaking version; version `0.2.0` tests and skills consume exactly these fields. These shapes MUST also be documented in `lib/workflow.js` JSDoc.

Responsibilities:

- `init-plan`: classify `.speckit` and `specs` as missing, existing directory, or conflict; never create them.
- `features`: return sorted valid feature directories, malformed entries, and the next numeric prefix.
- `resolve-feature`: apply the selector and path-safety contract, returning either one canonical feature or a structured error.
- `select-tasks`: parse task IDs, ranges, checkboxes, and dependencies; return ordered selected tasks and incomplete dependencies.
- `derive-stage`: apply the mechanical-validity predicates and exact stage precedence to artifacts, checkboxes, and verification blocks.

Task parsing MUST reject duplicate IDs, malformed task-like lines, unknown or duplicate dependencies, self-dependencies, dependencies on later tasks, and dependency cycles. Selection of an already completed task is allowed but returned with `checked: true`; `/speckit-implement` then reports it and does not reimplement it unless the user explicitly requests rework. If omitted `--selection` finds no incomplete task, return success with an empty `selected` array. Explicit selection resolving to no task is `INVALID_SELECTION`.

Verification parsing MUST reject duplicate timestamps, malformed or unknown fields, empty check lists, invalid exit codes/results, and overall results inconsistent with their checks. The exact no-evidence sentence is valid only when there is no verification block.

The helper MUST:

- require `--project-root` to resolve to a real directory;
- require `specs/` to be a real non-symlink directory for every operation except `init-plan`;
- use project-realpath confinement;
- reject traversal and symlink escapes;
- avoid following symlinked feature directories;
- parse arbitrary valid project artifacts rather than fixture-specific content;
- have no network behavior;
- have no Git behavior;
- have no dependency on an external SDD tool;
- return deterministic ordering.

DSH renders directory resources to the model with `Base directory for this skill: <absolute-path>`. Each retained skill MUST read that injected resource guidance, resolve `scripts/speckit-helper.mjs` against the displayed absolute base directory, obtain the target project root from the DSH session working directory, and invoke the helper through the DSH Bash tool in this form:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The supported command profile therefore requires Node `>=20` and a DSH process-execution/Bash tool. Retained skills MUST use the helper for these mechanical operations; they MUST NOT carry a second fallback implementation of the same parsers. If the resource guidance is absent, the Bash tool is unavailable, or the helper cannot execute, the skill stops before writing and reports the concrete blocker. Document this internal Node-helper requirement in the README. This is the approved reliability tradeoff for deterministic path, feature, task, and stage handling; the helper is not a general workflow engine.

The helper MUST NOT write files, make product decisions, generate artifacts, implement code, choose architecture, run tests, or perform semantic specification analysis. `/speckit-analyze` remains model-driven.

## 11. Plugin discovery and frontmatter

Rewrite `lib/index.js` around this exported, testable discovery seam:

```js
export function discoverSkills(skillsRoot) {
  // Returns { skills, diagnostics } and performs no logging or registration.
}
```

`skills` is a deterministic array of `{ name, description, whenToUse?, content, path }`. `diagnostics` is a deterministic array of `{ level: "warning" | "error", path, code, message }`. Production `apply(ctx)` MUST call `discoverSkills(SKILLS_ROOT)`, emit each returned diagnostic once through `ctx.logger.warn`, and register each discovered skill after adding the required `source`, `resourceBase`, and `invocation` fields. Tests MUST pass temporary fixture roots directly to `discoverSkills`; they MUST NOT mutate the package’s real `skills/` tree or mock Node module loading.

Discovery MUST:

- scan immediate children of `skillsRoot` only;
- sorts entries by code-point order before processing;
- considers only regular directories;
- registers a directory only when it contains a regular `SKILL.md`;
- does not follow directory or `SKILL.md` symlinks;
- treats `skills/scripts/` as a resource directory without warning;
- produces no warning during normal startup;
- registers exactly the eight retained skills;
- preserves `source: "bundled"`;
- uses the shared `skills/` directory as `resourceBase` so `scripts/speckit-helper.mjs` resolves;
- explicitly sets both invocation flags to `true`;
- collects and runs registration disposers in reverse order during cleanup.

Parse frontmatter with the maintained `yaml` package. Do not retain the current permissive hand-written parser.

Allowed frontmatter fields are exactly:

- required `name`: string with non-whitespace content and valid DSH kebab-case name;
- required `description`: string with non-whitespace content;
- optional `whenToUse`: string with non-whitespace content.

Reject unknown fields, duplicate YAML keys, malformed delimiters, non-object frontmatter, empty values, invalid names, and a frontmatter name that differs from its containing directory.

Malformed skills are skipped with one actionable warning containing the file path and reason. Use diagnostic codes `SKILL_READ_ERROR`, `INVALID_FRONTMATTER`, `NAME_MISMATCH`, and `DUPLICATE_SKILL` as applicable. A directory without `SKILL.md` is a normal resource directory and produces no diagnostic. Duplicate names are detected after deterministic sorting; the first valid entry wins and the later entry is skipped with one `DUPLICATE_SKILL` warning. Shipped skills MUST be valid, unique, and warning-free.

Statically import and use the named `isSkillName` export from `@deepseek-ai/dsh-skill` at module load. That package is a required peer dependency and is installed as a development dependency for isolated tests. If it is absent, importing `lib/index.js` or calling its exported discovery API is unsupported and fails with the normal module-resolution error before discovery; malformed-skill skip behavior applies only after required peers load successfully. Do not add a fallback validator or maintain a second skill-name regular expression.

## 12. Repository cleanup and target inventory

Delete:

- `skills/speckit-checklist/`;
- `skills/speckit-status/`;
- all current files under `skills/references/`;
- all current Python analysis scripts;
- `skills/scripts/phase_summary.sh`.

Retain or create only:

```text
README.md
LICENSE
NOTICE                         # optional, only when required by retained attribution
package.json
cordis.patch.yml
lib/index.js
lib/workflow.js
skills/speckit/SKILL.md
skills/speckit-constitution/SKILL.md
skills/speckit-specify/SKILL.md
skills/speckit-clarify/SKILL.md
skills/speckit-plan/SKILL.md
skills/speckit-tasks/SKILL.md
skills/speckit-analyze/SKILL.md
skills/speckit-implement/SKILL.md
skills/scripts/speckit-helper.mjs
test/*.test.js
```

Additional test fixtures under `test/fixtures/` are allowed. `NOTICE` is allowed only when the attribution review requires a separate notice; otherwise omit it. Do not retain an empty `skills/references/` directory.

Each `SKILL.md` MUST be concise and self-contained. Avoid copying the same full workflow into every skill; link to the next command with a short sentence instead.

## 13. Documentation, attribution, and legacy note

Rewrite `README.md` in concise English for DSH users. It MUST document only:

- independent DSH-only positioning;
- installation in DSH;
- the exact eight commands;
- the artifact layout;
- `/speckit init`;
- `--feature` selection;
- task IDs and partial implementation;
- derived stages and verification evidence;
- write-confirmation behavior;
- test-command discovery;
- Git non-mutation rules;
- DSH and Node compatibility;
- the breaking redesign.

Include a brief attribution stating that the workflow is inspired by GitHub Spec-Kit but is independent and incompatible. Also credit the initial migration from the `zhangqingyu/dsh-specify` predecessor, while stating that the current `dsh-specify-lite` project is independently maintained and does not promise predecessor compatibility.

Review the upstream license before retaining any copied material. Preserve legally required copyright or license notices in `LICENSE` or a dedicated notice file. Prefer newly written concise text over copied upstream prose. This instruction is not legal advice; do not remove a required notice merely to reduce file count.

The README MAY contain one section headed exactly:

```markdown
## Legacy artifacts from versions before 0.2.0
```

That section may explain manual migration only:

- move old feature directories into `specs/`;
- rename `specify.md` to `spec.md`;
- move the constitution to `.speckit/constitution.md`;
- discard unsupported brownfield or branch metadata;
- do not create `status.json` or `checklist.md`.

Do not implement migration detection or `/speckit-migrate`. Do not promise automatic compatibility.

## 14. Package metadata and compatibility

Update `package.json` to:

- set the breaking redesign version to `0.2.0`;
- use repository `git+https://github.com/MarcSierszen/dsh-specify-lite.git`;
- use homepage `https://github.com/MarcSierszen/dsh-specify-lite#readme`;
- use bugs URL `https://github.com/MarcSierszen/dsh-specify-lite/issues`;
- declare Node `>=20` in `engines`;
- document in README that the minimum tested DSH release is `0.1.1-rc.2`;
- declare peer compatibility with `@deepseek-ai/dsh-skill` as `>=0.1.1-rc.2 <0.2.0`;
- declare peer compatibility with `@deepseek-ai/cordis` as `^4.0.1`;
- include those peers as development dependencies for tests;
- add `yaml` as the only runtime dependency;
- use Node’s built-in test runner;
- provide `test` and syntax/static `check` scripts;
- use these exact export targets: `.` → `./lib/index.js`, `./workflow` → `./lib/workflow.js`, and `./package.json` → `./package.json`;
- keep the DSH bundle patch metadata.

Use this exact `files` inventory:

```json
[
  "lib/*.js",
  "cordis.patch.yml",
  "skills/*/SKILL.md",
  "skills/scripts/speckit-helper.mjs"
]
```

The expected packed paths are:

```text
package/package.json
package/README.md
package/LICENSE
package/cordis.patch.yml
package/lib/index.js
package/lib/workflow.js
package/skills/speckit/SKILL.md
package/skills/speckit-constitution/SKILL.md
package/skills/speckit-specify/SKILL.md
package/skills/speckit-clarify/SKILL.md
package/skills/speckit-plan/SKILL.md
package/skills/speckit-tasks/SKILL.md
package/skills/speckit-analyze/SKILL.md
package/skills/speckit-implement/SKILL.md
package/skills/scripts/speckit-helper.mjs
```

If `NOTICE` is required, add it to `files` and to the expected packed paths. No other file may be packed. Tests, fixtures, and this refactoring instruction MUST NOT ship.

## 15. Tests

Use Node’s built-in `node:test` and temporary fixture directories.

### Registration tests

Verify:

- exactly the eight expected skills register;
- registration order is deterministic;
- only immediate regular directories with regular `SKILL.md` files are scanned;
- `skills/scripts/` produces no warning;
- symlinks and nested candidates are not followed;
- names, descriptions, and optional `whenToUse` are valid;
- directory names equal frontmatter names;
- every registration’s `invocation` field contains both required flag values `{ modelInvocable: true, userInvocable: true }`; other registration fields remain present as separately asserted;
- `source` is `bundled`;
- `resourceBase` is the real shared `skills/` directory;
- clean startup has zero warnings;
- malformed and duplicate fixtures produce one useful warning each;
- cleanup unregisters all skills in reverse order;
- duplicate behavior is deterministic and does not remove the winner.

### Helper tests

Verify with temporary projects:

- initialization planning and idempotent classifications;
- file-versus-directory conflicts;
- feature enumeration and deterministic sorting;
- next-number calculation, including no features, malformed directories, and values above `999`;
- exact basename, unique slug, and project-relative selection;
- zero-match and ambiguous-slug errors;
- traversal, absolute-path, and symlink-escape rejection;
- task checkbox, ID, range, and dependency parsing;
- duplicate IDs/dependencies, unknown dependencies, self-dependencies, later-task dependencies, and cycles;
- overlap deduplication and document-order selection;
- empty implicit selection, completed explicit selection, and malformed, unknown, or reversed selections;
- derived `invalid`, `not-started`, `specified`, `planned`, `tasked`, `in-progress`, and `complete` stages with precedence;
- failed, partial, absent, malformed, duplicate-timestamp, and superseding verification evidence;
- arbitrary valid artifacts rather than repository-specific fixtures;
- CLI JSON, stderr, and exit-code behavior.

### Instruction consistency tests

Scan shipped product files and verify:

- every documented command has one corresponding `SKILL.md`;
- every registered skill is documented;
- exactly eight commands exist;
- no dot-style command remains;
- no removed command is advertised;
- no external SDD CLI, `uv`, Claude integration, or upstream runtime instruction remains;
- no instruction tells the model to mutate Git;
- artifact paths consistently use `.speckit/constitution.md` and `specs/.../{spec,plan,tasks}.md`;
- required headings and identifier formats are present in the relevant skills;
- every referenced bundled resource exists;
- all retained frontmatter is valid.

Forbidden-reference scans apply to shipped product files only. Exclude:

- this refactoring instruction;
- tests and fixtures;
- the contents of the explicitly delimited README legacy section.

A Git-safety prohibition is allowed. Instructions to execute mutating Git commands are forbidden.

### Packaging tests

Verify:

- `npm pack --dry-run --json` contains the expected runtime inventory;
- deleted skills, references, analyzers, and phase-summary scripts are absent;
- tests and fixtures are not shipped;
- the package imports through every declared export;
- the plugin loads from the packed artifact;
- the plugin boots in a minimal supported DSH profile without startup warnings.

Do not claim that registration or fixture tests prove the quality of model-generated specifications. Mechanical helper behavior is unit-tested; semantic SDD behavior remains model-driven and should be reviewed through representative invocation scenarios.

## 16. Acceptance criteria

The refactor is complete only when all of the following are true:

- exactly eight supported skills register and are documented;
- the removed checklist and status skills are absent;
- the repository contains no unsupported brownfield, reverse-engineering, branch-management, Claude, or external CLI workflow;
- all command references use kebab-case;
- all generated artifact instructions use the exact three-artifact feature layout;
- initialization is explicit, safe, and idempotent;
- feature selection is deterministic, ambiguity-safe, and project-confined;
- partial task selection and dependencies follow the defined grammar;
- semantic analysis is model-driven and no canned analyzer remains;
- the helper is generic, read-only, deterministic, and tested;
- valid startup emits no warning;
- malformed skills fail closed with useful diagnostics;
- Git state is never mutated by plugin instructions or helper code;
- existing artifacts are never overwritten silently;
- completion requires completed tasks and full passing verification evidence;
- README describes only the DSH-exclusive product, apart from the delimited legacy note;
- attribution and required license notices are preserved;
- package metadata and exports are complete;
- registration, helper, consistency, and packaging tests pass;
- `npm pack --dry-run --json` contains only the intended runtime files.
