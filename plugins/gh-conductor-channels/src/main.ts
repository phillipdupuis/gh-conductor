#!/usr/bin/env bun
// Bootstrap for the channel server. The installed plugin copy has no node_modules on first run:
// install dependencies, then hand off to server.ts. Nothing here may import from node_modules,
// and nothing may write to stdout — that is the MCP transport.

import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
if (!existsSync(join(root, "node_modules"))) {
  console.error("gh-conductor-channels: first run — installing dependencies (bun install)…");
  const proc = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], {
    cwd: root,
    stdout: "ignore",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    console.error("gh-conductor-channels: bun install failed");
    process.exit(1);
  }
}

await import("./server.ts");
