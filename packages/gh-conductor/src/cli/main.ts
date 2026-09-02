#!/usr/bin/env bun
// Entrypoint for `gh-conductor`, both from source and as the bundled plugins/gh-conductor/dist/gh-conductor.js.

if (!Bun.semver.satisfies(Bun.version, ">=1.2.17")) {
  console.error(`gh-conductor needs Bun >= 1.2.17 (found ${Bun.version}). Run: bun upgrade`);
  process.exit(1);
}

const { main } = await import("./run.ts");
try {
  // Set the code rather than process.exit: exiting here can truncate piped stdout on Windows.
  process.exitCode = await main(process.argv.slice(2));
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}

export {}; // top-level await needs this file to be a module
