---
description: Pick up work from a handoff document in .pi/handoffs/
argument-hint: "[filename]"
---
Continue work from a previous session's handoff document.

- If a filename was given, read `.pi/handoffs/$1` (or `$1` directly if it's a path).
- Otherwise, find the most recently modified file in `.pi/handoffs/` and read it. If the directory is empty or missing, say so and stop.

After reading it:
1. Verify the described state still holds (`git status`, `git log --oneline -5`, check the key files it mentions).
2. Give me a 3-5 bullet summary of where things stand and flag anything that has drifted since the handoff was written.
3. Start on the "Immediate Next Steps" section unless I say otherwise.
