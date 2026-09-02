// Where the CLI thinks it lives. Kept out of src/server so CLI commands don't drag the app's
// HTML import into every invocation.

import { basename, dirname, join } from "node:path";

export const DEFAULT_PORT = 4747;

const mainDir = dirname(Bun.main);

/** The dist/ directory when running the built bundle; null when running from source. */
export const BUNDLE_DIR: string | null = basename(mainDir) === "dist" ? mainDir : null;

/**
 * The directory the CLI was installed into: the plugin root when running the bundle
 * (`<plugin>/dist/gh-conductor.js`), the package root when running from source.
 */
export const ROOT = BUNDLE_DIR ? dirname(BUNDLE_DIR) : join(import.meta.dir, "..", "..");
