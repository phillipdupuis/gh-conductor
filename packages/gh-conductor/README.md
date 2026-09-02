# packages/gh-conductor

Source for the `gh-conductor` CLI and its local graph view. Building it produces
`plugins/gh-conductor/dist`, the payload the plugin actually ships.

```
src/core     zod schemas (the types), graph model, ready-work computation — isomorphic, no Bun/node imports
src/github   gh api I/O
src/layout   Graphviz DOT emitter (`graph --dot`); the app lays itself out from src/core
src/cli      gh-conductor entrypoint, commands, background-server lifecycle
src/server   Bun.serve: /api/issues/:owner/:repo/:number, /api/health, and the app
src/app      React + React Flow + Tailwind (own tsconfig: DOM, no bun-types)
fixtures     saved graphs for developing the UI without GitHub
```

## Dev loop

Run everything from this directory.

```
bun install
bun run check                     # tsc (both halves) + oxlint + oxfmt --check
bun test                          # covers src/core
bun run serve                     # foreground server with HMR (add --from fixtures/upgrade-python-mid.json)
bun run build                     # bundles into ../../plugins/gh-conductor/dist
```

`bun run build` is not automatic: commit the refreshed `dist/` as part of a release, and bump
`version` in `plugins/gh-conductor/.claude-plugin/plugin.json` first — that value is what
`gh-conductor --version` prints.
