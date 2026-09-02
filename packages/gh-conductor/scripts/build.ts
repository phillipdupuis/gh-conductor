#!/usr/bin/env bun
// Bundles the CLI (and, through the server's index.html import, the whole app) into the committed
// plugin payload at plugins/gh-conductor/dist. Bun.build, not `bun build`, because bun-plugin-tailwind
// only runs through the JS API.

import { rm } from "node:fs/promises";
import { join, relative } from "node:path";
import tailwind from "bun-plugin-tailwind";

const PKG = join(import.meta.dir, "..");
const PLUGIN = join(PKG, "..", "..", "plugins", "gh-conductor");
const OUT = join(PLUGIN, "dist");

const manifest = (await Bun.file(join(PLUGIN, ".claude-plugin", "plugin.json")).json()) as {
  version: string;
};

await rm(OUT, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [join(PKG, "src", "cli", "main.ts")],
  target: "bun",
  outdir: OUT,
  minify: true,
  // Absolute asset URLs: the app is served at nested routes (/owner/repo/N), where relative
  // "./index-*.js" would resolve to /owner/repo/index-*.js and hit the page route instead.
  publicPath: "/",
  plugins: [tailwind],
  naming: {
    entry: "gh-conductor.[ext]",
    chunk: "[name]-[hash].[ext]",
    asset: "[name]-[hash].[ext]",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    __VERSION__: JSON.stringify(manifest.version),
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(`gh-conductor ${manifest.version} → ${relative(process.cwd(), OUT)}`);
for (const out of result.outputs.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`  ${relative(OUT, out.path).padEnd(40)} ${(out.size / 1024).toFixed(1)} kB`);
}
