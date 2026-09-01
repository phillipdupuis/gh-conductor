# gh-conductor (plugin)

A Claude Code plugin that acts like a good project manager, backed by GitHub Issues. It breaks a large, fuzzy feature into actionable items, delegates them, keeps them synchronized, and pushes the work forward. Issues are nodes in a DAG; GitHub's native sub-issues and "blocked by" dependencies are the edges — so agents and humans always have a clear next step, and the plan survives context resets.

**Status:** alpha — expect rough edges and breaking changes.

## `gh-conductor`

Requires [bun](https://bun.sh) and `gh` ≥ 2.94 authenticated for the repo. Dependencies are installed automatically on first run (`bun install`), so a plugin install is just the clone.

```
bun src/cli/main.ts <command> <issue> [--repo owner/name] [--json]
bun src/cli/main.ts serve [--port N] [--from <graph.json>] [--stop]
bun src/cli/main.ts config [set <key> <value> [--confirmed]]

graph   <issue>  every sub-issue, plus the issues one blocked-by hop away, with state, assignees,
                 blockers and linked PR (--dot for Graphviz source)
ready   <issue>  open sub-issues whose blockers are all closed (--include-assigned keeps human-assigned ones)
status  <issue>  ready / in progress / in review / assigned / blocked / done
view    <issue>  open the issue's graph in the browser (starts the local server if needed);
                 prints the URL. --no-open just prints.
serve            run the graph server in the foreground (dev). --from serves a saved graph for any
                 issue. --stop stops the background server started by `view`.
config           effective preferences and where each came from (--json for machines).
                 `config set <key> <value>` records a preference in the workspace .gh-conductor.toml;
                 --confirmed marks it as agent-inferred and user-confirmed rather than stated outright.
```

`<issue>` is an issue number, `#N`, `owner/repo#N`, or a GitHub issue URL. `--from` reads a graph saved by `graph <issue> --json` (or a fixture) instead of GitHub.

The CLI never writes to GitHub (`config set` writes only the local `.gh-conductor.toml`). `view` starts one background server per machine (`http://localhost:4747`), reuses it on later calls, and lets it exit after ten idle minutes.

A PreToolUse hook (`hooks/`) forces an explicit permission prompt for every CLI invocation, even under a Bash allowlist — during alpha, each call is meant to be consciously reviewed.

## Layout

```
src/core     zod schemas (the types), graph model, ready-work computation — isomorphic, no Bun/node imports
src/github   gh api I/O
src/layout   Graphviz DOT emitter (`graph --dot`); the app lays itself out from src/core
src/cli      gh-conductor entrypoint, commands, background-server lifecycle
src/server   Bun.serve: /api/issues/:owner/:repo/:number, /api/health, and the app
src/app      React + React Flow + Tailwind (own tsconfig: DOM, no bun-types)
skills       the skills that drive the orchestration (plan, advance, clarify, delegate, config)
hooks        PreToolUse hook forcing per-call approval of the CLI
fixtures     saved graphs for developing the UI without GitHub: bun run serve -- --from fixtures/upgrade-python-mid.json
```

`bun run check` typechecks both halves; `bun test` covers `src/core`.
