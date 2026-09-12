---
name: speckit-specify
description: Create or safely revise a feature specification focused on product behavior and outcomes.
whenToUse: Use for /speckit-specify when a feature description should become specs/<feature>/spec.md.
---

# `/speckit-specify` — Feature specification

Require a feature description. Ask about splitting only when it contains independently deliverable features. Keep the specification about **what** and **why**; technologies and file design belong only when the user supplied them as product constraints.

## Helper and selection

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, and obtain the absolute project root from the DSH session working directory. Use Bash in this form:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" <operation> --project-root "<absolute-project-root>" ...
```

The helper is read-only; never duplicate its feature logic. If resource guidance, Bash, or execution is unavailable, stop before writing. Run `init-plan` and require real `.speckit/` and `specs/` directories, otherwise direct the user to `/speckit init`.

Without `--feature`, run `features`, derive an ASCII lowercase kebab-case slug, and propose `specs/<nextPrefix>-<slug>/spec.md`; ask for a slug if normalization is empty or misleading. Immediately before creation, run `features` again. If the path appeared, recompute once; if collision remains, stop. Preserve malformed-child diagnostics.

With `--feature`, use `resolve-feature --selector "<value>"`. This is an explicit revision: read the existing `spec.md`, propose changes, and obtain confirmation before editing. Never silently replace it.

## Required document

Use these headings exactly once and in order:

```markdown
# Feature: <name>
## Problem
## Goals
## User Stories
## Functional Requirements
## Success Criteria
## Edge Cases
## Out of Scope
## Assumptions
## Open Questions
```

Use stable `US-001`, `FR-001`, `SC-001`, `EC-001`, and `OQ-001` identifiers; do not renumber unaffected entries. Every requirement and criterion must be independently checkable. Mark questions as `- [BLOCKING] OQ-001: ...` or `- [NON-BLOCKING] OQ-002: ...`; expose uncertainty rather than inventing product choices.

Explicit invocation authorizes only creation of the missing requested artifact. Wrong-type, symlinked, unreadable, unsafe, or conflicting paths stop the command. Preserve unrelated content, create no other feature artifacts, and never mutate Git. Summarize the creation or approved revision, then recommend `/speckit-clarify` when ambiguity remains or `/speckit-plan` otherwise.
