---
name: delegate
description: Decide who should work an issue — this agent or a specific human — and route it with native GitHub assignment. Use when creating issues, when a question needs a particular person's answer, or when ready work may already belong to someone else.
---

> **Stub.** Steps are placeholders — and this skill is deliberately thin in v0: with one shared GitHub identity nothing can be assigned *to* the agent, so delegation reduces to routing among humans and deciding what the agent may take on its own. Its full weight arrives with multi-agent dispatch.

**Moment:** the recurring "who?" decision inside `plan`, `clarify`, and `advance`.

**Owns (capability checklist):** assign · staff · coordinate. Almost everything here is **policy, not invariant** — which work the agent takes autonomously, who answers what, the team roster and their domains all vary per person and org. This skill is the home address for that policy bundle.

## Steps (skeleton)

1. **Read the user's delegation preferences** — their instructions (CLAUDE.md) today; a plugin settings store later.
2. **Questions go to whoever's call it is** — default: the person who requested the work; override when the answer belongs to someone else (compliance, management).
3. **Respect occupancy signals** — another assignee or a linked branch means taken: ask before touching. Assignee is guidance, never a hard block on the ready computation.
4. **(future) Dispatch** — hand ready-frontier issues to parallel agents.
