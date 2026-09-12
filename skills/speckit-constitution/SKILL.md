---
name: speckit-constitution
description: Create or safely revise concrete project-wide principles in .speckit/constitution.md.
whenToUse: Use for /speckit-constitution or when defining checkable project-wide constraints for later specifications and plans.
---

# `/speckit-constitution` — Project constraints

Ask for the principles and constraints that genuinely govern this project. Keep them concrete and checkable; do not impose irrelevant categories.

Read the injected `Base directory for this skill`, resolve its absolute `scripts/speckit-helper.mjs`, obtain the absolute project root from the DSH session working directory, and run:

```bash
node "<absolute-resource-base>/scripts/speckit-helper.mjs" init-plan --project-root "<absolute-project-root>"
```

The helper is read-only. Do not duplicate its checks. If its resource guidance, Bash, or execution is unavailable, stop before writing. Require `.speckit/` and `specs/` to be real directories; otherwise direct the user to `/speckit init`. A wrong-type, unreadable, unsafe, or conflicting path stops the command.

For a missing `.speckit/constitution.md`, explicit invocation authorizes creation after the principles are known. For an existing file:

1. Read it first.
2. Preserve its relevant content.
3. Explain the exact proposed changes and obtain confirmation before editing, unless those exact changes were already authorized.

Never silently overwrite or truncate content, and never mutate Git. Summarize the resulting constraints and recommend `/speckit-specify`.
