---
name: plan
description: Turn a fuzzy ask into an actionable issue graph — deliverable chunks as sub-issues under a parent issue, wired with blocked-by edges. Use when starting a new piece of work, or when new facts have invalidated the current plan and the graph needs restructuring.
---

**Moment:** the kickoff — a fuzzy ask exists, no graph does. Also the re-entry point when reality breaks the plan (a dead hypothesis, a missing prerequisite): re-planning is just planning with new facts.

## Steps

1. **Look before you ask** — read the code the ask touches; know what exists, what's missing, where the work would live.
2. **Cut into chunks** — each one deliverable PR with a checkable Done-when; note which builds on which (those are the edges). Chunks are not decomposed further.
3. **Materialize on GitHub** — create the parent issue, then each chunk as a sub-issue with its blocked-by edges. Issues first, chat never (chat doesn't survive a context reset).
4. **Route each issue** to whoever should own it (see `delegate`).
5. **Verify the graph** — every chunk present, edges as intended, the first chunk(s) ready — then hand off to `advance`.
