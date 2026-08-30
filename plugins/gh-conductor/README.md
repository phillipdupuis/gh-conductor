# gh-conductor (plugin)

A Claude Code plugin that acts like a good project manager, backed by GitHub Issues. It breaks a large, fuzzy feature into actionable items, delegates them, keeps them synchronized, and pushes the work forward. Issues are nodes in a DAG; GitHub's native sub-issues and "blocked by" dependencies are the edges — so agents and humans always have a clear next step, and the plan survives context resets.

**Status:** pre-alpha. The read-only `conductor` CLI and its graph view exist; the skills that drive them do not yet.

## `conductor`

Requires [bun](https://bun.sh) and `gh` ≥ 2.94 authenticated for the repo. Dependencies are installed automatically on first run (`bun install`), so a plugin install is just the clone.

```
bun src/cli/main.ts <command> <epic> [--repo owner/name] [--json]

graph   <epic>   every sub-issue with state, assignees, blockers, linked PR (--dot for Graphviz source)
ready   <epic>   open sub-issues whose blockers are all closed
status  <epic>   ready / in progress / waiting on a human / blocked / done
view    <epic>   open the epic's graph in the browser (starts the local server if needed)
serve            run the graph server in the foreground; --from <graph.json> serves a saved graph
```

The CLI is read-only: it never writes to GitHub. `view` starts one background server per machine (`http://localhost:4747`), reuses it on later calls, and lets it exit after ten idle minutes.

## Layout

```
src/core     zod schemas (the types), graph model, ready-work computation — isomorphic, no Bun/node imports
src/github   gh api I/O
src/layout   Graphviz DOT emitter (`graph --dot`); the app lays itself out from src/core
src/cli      conductor entrypoint, commands, background-server lifecycle
src/server   Bun.serve: /api/epics/:owner/:repo/:number, /api/health, and the app
src/app      React + React Flow + Tailwind (own tsconfig: DOM, no bun-types)
fixtures     saved graphs for developing the UI without GitHub: bun run serve -- --from fixtures/upgrade-python-mid.json
```

`bun run check` typechecks both halves; `bun test` covers `src/core`.
