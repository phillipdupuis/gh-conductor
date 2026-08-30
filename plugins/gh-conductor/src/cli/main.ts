#!/usr/bin/env bun
// Bootstrap for `conductor`. Plugin install is a `git clone`, so on first run the dependencies are
// not there yet: install them, then hand off to run.ts. Nothing here may import from node_modules.

import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
if (!existsSync(join(root, "node_modules"))) {
  console.error("conductor: first run — installing dependencies (bun install)…");
  const proc = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], { cwd: root, stdout: "ignore", stderr: "inherit" });
  if (proc.exitCode !== 0) {
    console.error("conductor: bun install failed");
    process.exit(1);
  }
}

const { main } = await import("./run.ts");
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
