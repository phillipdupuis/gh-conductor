---
name: delegate
description: Decide who should work an issue — this agent or a specific human — and route it with native GitHub assignment. Use when creating issues, when a question needs a particular person's answer, or when ready work may already belong to someone else.
---

**Moment:** the recurring "who?" decision inside `plan`, `clarify`, and `advance`.

Which work the agent takes autonomously, who answers what, and the team roster all vary per person and org — so read the user's stated policy before applying defaults.

## Steps

1. **Read the user's delegation preferences** — their instructions (CLAUDE.md), plus configured workspace preferences via `bun ${CLAUDE_PLUGIN_ROOT}/dist/gh-conductor.js config --json` (proximate wins: instructions beat config).
2. **Questions go to whoever's call it is** — default: the person who requested the work; override when the answer belongs to someone else (compliance, management).
3. **Respect occupancy signals** — another assignee or a linked branch means taken: ask before touching. Assignee is guidance, never a hard block on the ready computation.
