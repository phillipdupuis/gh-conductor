// Discovery and mutation of the workspace .gh-conductor.toml. The only place the CLI touches disk
// with intent to write; it still never writes to GitHub.

import { dirname, join, resolve } from "node:path";
import {
  CONFIG_FILENAME,
  type ConfigFile,
  ConfigFile as ConfigFileSchema,
  type Provenance,
  type SettingKey,
  coerceSettingValue,
  emitToml,
} from "../core/config.ts";

/** Nearest .gh-conductor.toml, walking up from `start` (like .prettierrc et al.). */
export async function findConfigPath(start = process.cwd()): Promise<string | null> {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (await Bun.file(candidate).exists()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadConfigFile(path: string): Promise<ConfigFile> {
  return ConfigFileSchema.parse(Bun.TOML.parse(await Bun.file(path).text()));
}

/** Where a fresh config file goes: the git toplevel, else the current directory. */
function workspaceRoot(): string {
  const proc = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  const out = proc.success ? proc.stdout.toString().trim() : "";
  return out || process.cwd();
}

export async function setSetting(
  key: SettingKey,
  raw: string,
  provenance: Provenance,
): Promise<{ path: string; value: boolean | number | string } | { error: string }> {
  const value = coerceSettingValue(key, raw);
  if (value === undefined) return { error: `invalid value "${raw}" for ${key}` };
  const existing = await findConfigPath();
  const path = existing ?? join(workspaceRoot(), CONFIG_FILENAME);
  const file: ConfigFile = existing ? await loadConfigFile(existing) : {};
  (file as Record<string, unknown>)[key] = value;
  file.provenance = { ...file.provenance, [key]: provenance };
  await Bun.write(path, emitToml(file));
  return { path, value };
}
