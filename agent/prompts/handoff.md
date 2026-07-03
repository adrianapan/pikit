---
description: Generate a handoff document capturing session state for seamless continuation in a new session
argument-hint: "[filename]"
---
Create a comprehensive handoff document capturing everything needed to continue this session's work in a fresh session.

## Filename

Save it as `${1:-HANDOFF_<topic>_<MM_DD>_<HH_MM>.md}` — when no name was given, derive `<topic>` from the main subject of this session (short, uppercase, underscores) and fill the timestamp from the current date/time. Save into `.pi/handoffs/` in the project root (same convention as `.pi/plans/`), creating the directory if needed.

## Before writing

- Run `git status` and `git log --oneline -10` to capture repository state — this is essential context.
- Review the conversation for decisions made, approaches rejected, and anything surprising that was discovered.

## Document structure

```markdown
# Handoff: <topic>
Date: <ISO date/time> | Branch: <branch> | Status: <in progress / blocked / ready for review>

## Summary
2-4 sentences: what we set out to do, where things stand now.

## Work Completed
- [x] Each meaningful change, with the *why* when a decision was non-obvious

## Files Affected
- Created: path/to/file — purpose
- Modified: path/to/file:line — what changed
- Deleted: ...

## Technical Context
Architecture decisions, dependencies added/changed, config changes, gotchas discovered. Include anything the next session would otherwise have to re-derive.

## Current State
- Working: ...
- Not working / known issues: ...
- Tests: <passing/failing/not run, with output if failing>
- Git: <uncommitted changes, branch state>

## Next Steps
### Immediate (always include this section — it is critical)
1. Concrete first action with file paths and line numbers
### Then
- Subsequent tasks
### Blocked on
- Anything waiting on external input or decisions

## Useful Commands & Resources
Commands to run (build, test, dev server), relevant docs/tickets/PRs.
```

## Rules

- Be specific: file paths, line numbers, exact commands — not vague descriptions.
- Keep it under ~2000 words unless complexity genuinely demands more.
- Capture *why* decisions were made, not just what was done — rejected approaches save the next session from repeating them.
- Actually write the file with the write tool; don't just print the content.
- After saving, tell me the path and remind me to run `/pickup` in a fresh session `/new` to continue from it.
