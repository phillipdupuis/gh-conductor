# vendor/

`viz.mjs` is the ESM build of [@viz-js/viz](https://github.com/mdaines/viz-js) (Graphviz compiled to
WebAssembly, MIT). The CLI runs it under bun to lay out the epic graph for `conductor view`; it never
ships to the browser. Vendored rather than installed so a plugin `git clone` works offline with no
install step.

- version: `3.29.0`
- source: <https://cdn.jsdelivr.net/npm/@viz-js/viz@3.29.0/dist/viz.js>
- sha256: `2b3a3b3387e427d7602af4761b431ccc88513bed4c08ade5a65652b182dbd3c0`
- size: 1185234 bytes

Refresh with `bun run vendor [version]` (rewrites this file and `viz.mjs`), then commit both.
`viz.d.mts` is hand-written and only declares what we call.
