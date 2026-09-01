---
name: config
description: Configure how gh-conductor behaves — settings and preferences for this user and workspace. Use on first run in a workspace with no .gh-conductor.toml, when the user complains about or pushes back on how the orchestrator works, or when a one-off correction sounds like it should become permanent.
---

**Moment:** first run in a workspace (onboarding), and any time the user is unhappy with a
behavior that a preference could fix.

Settings live in the workspace `.gh-conductor.toml`, managed through the CLI — never read or
write the file directly.

## Steps

1. **Read current state** — `bun ${CLAUDE_PLUGIN_ROOT}/src/cli/main.ts config --json`: every
   setting, its effective value, and where it came from (shipped default vs. workspace file,
   stated vs. confirmed).
2. **Onboarding (no config file yet)** — a guided conversation, not a form: ask a high-leverage
   question, do independent research on the answer (gh: the repos named, the org's `.github` repo,
   collaborators, CODEOWNERS, Projects), then present inferred understanding for cheap yes/no
   confirmation. The deliverable is a drafted config the user ratifies, like `/init` drafts a
   CLAUDE.md. Research findings also seed `delegate`'s roster.
3. **Complaint capture** — when the user corrects a behavior, fix the instance first, then offer:
   "want me to make that permanent?" On yes:
   `bun ${CLAUDE_PLUGIN_ROOT}/src/cli/main.ts config set <key> <value>`, adding `--confirmed`
   when the value was inferred and confirmed rather than stated outright.
4. **Precedence: proximate wins.** In-session instructions > the user's CLAUDE.md > workspace
   config > shipped defaults. Cross-layer conflicts resolve silently in that order — never ask.
   Ask only when two instructions _within_ a layer contradict each other.
