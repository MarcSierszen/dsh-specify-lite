---
name: speckit-plan
description: Create a repository-informed technical plan mapped to a valid feature specification.
whenToUse: Use for /speckit-plan after specification, when architecture, interfaces, testing, risks, and fallbacks must be planned.
---

# `/speckit-plan` — Technical plan

## Resolve and validate

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, obtain the absolute project root from the DSH session working directory, and invoke it through Bash:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper is read-only; do not reproduce its feature or artifact checks. If guidance, Bash, or execution is unavailable, stop before writing. Run `features`, resolve `--feature` with `resolve-feature`, or select only the sole valid feature; ask when ambiguous and report none when absent. Run `derive-stage --feature "<absolute-feature-path>"`. Require valid `spec.md` and stop while any `[BLOCKING] OQ-*` remains. Direct an uninitialized project to `/speckit init`.

Read the specification, optional `.speckit/constitution.md`, and relevant repository conventions. Infer routine technical details from observed code. Ask only about consequential architecture or product choices. Stay within scope.

## Required document

Use these headings exactly once and in order:

```markdown
# Plan: <name>
## Technical Context
## Constraints from Constitution and Specification
## Architecture and Components
## Data Flow and Interfaces
## Dependencies
## Requirement Mapping
## Testing Strategy
## Risks and Fallbacks
```

Map relevant `FR-*`, `SC-*`, and applicable `EC-*` identifiers. Include integration details, tests, risks, and fallbacks.

Explicit invocation authorizes creation of a missing `plan.md`. If it exists, read it, explain the proposed revision, and obtain confirmation unless already authorized; preserve unrelated content and stable identifiers. Stop on wrong-type, symlinked, unreadable, unsafe, or conflicting paths. Create no extra artifacts and never mutate Git. Summarize the plan and recommend `/speckit-tasks`.
