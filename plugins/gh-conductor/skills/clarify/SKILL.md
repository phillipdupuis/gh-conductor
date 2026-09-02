---
name: clarify
description: Resolve an unknown that stands in the way of progress. Use when blocked, missing information, or unsure how to proceed — investigate in place when the repo or tools can answer; when only a human can, file the question as an issue with blocked-by edges and keep moving.
---

**Moment:** mid-work, you hit something you don't know or a call that isn't yours to make. Questions never stop the agent; edges do.

## Steps

1. **Pick the branch:** can the repo, history, or tools answer this? Investigate in place and record the findings where the work lives.
2. **Only a human can answer** → write the question as an issue: Known / Unknown / Recommendation (a real pick, with the reason). When `confirm_writes` is on (`bun ${CLAUDE_PLUGIN_ROOT}/dist/gh-conductor.js config --json`), show the drafted issue and wait for a yes before creating it.
3. **Wire the edges** — blocked-by from every issue whose work depends on the answer — and route it to whoever's call it is (see `delegate`).
4. **Keep moving** — return to whatever is still ready (`advance`); never sit and wait.
