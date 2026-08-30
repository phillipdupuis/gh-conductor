#!/usr/bin/env bun
// Refresh the vendored Graphviz engine (@viz-js/viz, ESM build) from the npm CDN.
// Usage: bun run vendor [version]   — defaults to VERSION below. Commit the result.

const VERSION = process.argv[2] ?? "3.29.0";
const url = `https://cdn.jsdelivr.net/npm/@viz-js/viz@${VERSION}/dist/viz.js`;
const dest = new URL("../vendor/viz.mjs", import.meta.url);
const readme = new URL("../vendor/README.md", import.meta.url);

const res = await fetch(url);
if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
const bytes = new Uint8Array(await res.arrayBuffer());
const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
await Bun.write(dest, bytes);

await Bun.write(readme, `# vendor/

\`viz.mjs\` is the ESM build of [@viz-js/viz](https://github.com/mdaines/viz-js) (Graphviz compiled to
WebAssembly, MIT). The CLI runs it under bun to lay out the epic graph for \`conductor view\`; it never
ships to the browser. Vendored rather than installed so a plugin \`git clone\` works offline with no
install step.

- version: \`${VERSION}\`
- source: <${url}>
- sha256: \`${sha256}\`
- size: ${bytes.byteLength} bytes

Refresh with \`bun run vendor [version]\` (rewrites this file and \`viz.mjs\`), then commit both.
\`viz.d.mts\` is hand-written and only declares what we call.
`);
console.log(`vendored @viz-js/viz@${VERSION} (${bytes.byteLength} bytes, sha256 ${sha256.slice(0, 12)}…)`);
