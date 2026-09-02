# gh-conductor (plugin)

A Claude Code plugin that acts like a good project manager, backed by GitHub Issues. It breaks a large, fuzzy feature into actionable items, delegates them, keeps them synchronized, and pushes the work forward. Issues are nodes in a DAG; GitHub's native sub-issues and "blocked by" dependencies are the edges — so agents and humans always have a clear next step, and the plan survives context resets.

**Status:** alpha — expect rough edges and breaking changes.

## `gh-conductor`

Requires [bun](https://bun.sh) ≥ 1.2.17 and `gh` ≥ 2.94 authenticated for the repo. The CLI ships pre-built (`dist/gh-conductor.js`), so a plugin install is just the clone — nothing is installed on your machine.

```
bun <plugin>/dist/gh-conductor.js <command> <issue> [--repo owner/name] [--json]
bun <plugin>/dist/gh-conductor.js serve [--port N] [--from <graph.json>] [--dev] [--stop]
bun <plugin>/dist/gh-conductor.js config [set <key> <value> [--confirmed]]

graph   <issue>  every sub-issue, plus the issues one blocked-by hop away, with state, assignees,
                 blockers and linked PR (--dot for Graphviz source)
ready   <issue>  open sub-issues whose blockers are all closed (--include-assigned keeps human-assigned ones)
status  <issue>  ready / in progress / in review / assigned / blocked / done
view    <issue>  open the issue's graph in the browser (starts the local server if needed);
                 prints the URL. --no-open just prints.
serve            run the graph server in the foreground. --from serves a saved graph for any
                 issue. --dev turns on Bun's HMR + browser console forwarding for UI work.
                 --stop stops the background server started by `view`.
config           effective preferences and where each came from (--json for machines).
                 `config set <key> <value>` records a preference in the workspace .gh-conductor.toml;
                 --confirmed marks it as agent-inferred and user-confirmed rather than stated outright.
```

`--version` prints the plugin version. `<issue>` is an issue number, `#N`, `owner/repo#N`, or a GitHub issue URL. `--from` reads a graph saved by `graph <issue> --json` (or a fixture) instead of GitHub.

The CLI never writes to GitHub (`config set` writes only the local `.gh-conductor.toml`). `view` starts one background server per machine (`http://localhost:4747`), reuses it on later calls, and lets it exit after ten idle minutes.

## Permissions

The skills write to GitHub with plain `gh` commands (`gh issue create`, `gh issue edit`, `gh pr create`, …). By default they go ahead as soon as the plan is settled. To be asked first, turn on `confirm_writes`:

```
bun <plugin>/dist/gh-conductor.js config set confirm_writes true
```

For enforcement by Claude Code itself, add `ask` rules for the write commands to your settings (`~/.claude/settings.json` for every project, or the project's `.claude/settings.json`):

```json
{
  "permissions": {
    "ask": [
      "Bash(gh issue create *)",
      "Bash(gh issue edit *)",
      "Bash(gh issue close *)",
      "Bash(gh issue comment *)",
      "Bash(gh pr create *)",
      "Bash(gh pr ready *)",
      "Bash(gh pr edit *)",
      "Bash(gh api *)"
    ]
  }
}
```

## Layout

```
dist              the built CLI and the app's assets — `gh-conductor.js` is the entrypoint
skills            the skills that drive the orchestration (plan, advance, clarify, delegate, config)
.claude-plugin    the plugin manifest
```

The source for `dist` lives in [`packages/gh-conductor`](../../packages/gh-conductor).
