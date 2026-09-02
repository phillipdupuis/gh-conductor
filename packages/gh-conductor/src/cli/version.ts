// __VERSION__ is substituted by scripts/build.ts from the plugin manifest; unbundled it is absent.

export const VERSION: string = typeof __VERSION__ === "undefined" ? "dev" : __VERSION__;
