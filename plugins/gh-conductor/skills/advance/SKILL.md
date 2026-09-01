---
name: advance
description: Push ready work forward. Use in any session to pick a graph back up — sweep what humans did since last time (replies, merges, closes), then work issues from the ready frontier until nothing is ready, and report what's waiting on whom.
---

**Moment:** every session — the execution loop. Runs right after `plan` finishes and on every pickup thereafter. GitHub state is the only memory; nothing is narrated.

## Steps

1. **Read state from GitHub** — the graph, the ready frontier, what's waiting on a human: `bun ${CLAUDE_PLUGIN_ROOT}/src/cli/main.ts status <issue>` (and `graph` / `ready` for detail).
2. **Sweep what changed** — replies to question issues (propose the close, or name the gap and leave open), merged PRs, stale assignments a PM would nudge.
3. **Pick one ready issue** — in-progress (draft PR) first, then plan order. Read its closed blockers' answers at point of use; an insufficient answer reopens that blocker.
4. **Work it** — branch, push early, draft PR with a plan checklist, tick as you go. A call you can't make alone → `clarify`. Done-when holds and tests pass → mark the PR ready.
5. **Loop** until nothing is ready or in progress, then report exactly what's waiting on whom and what's blocked behind it.
6. **Everything done?** Check the parent's Done-when against what merged; gaps become new chunks. Otherwise propose closing — never close unilaterally.
