// User preferences: the workspace .gh-conductor.toml merged over shipped defaults. Pure — schema,
// merge, and (de)serialization of the constrained file shape; discovery and disk I/O live in
// src/cli/config.ts. Skills never read the file directly: they call `gh-conductor config`, so the
// storage mechanics can change without touching skill text. Configured values are defaults from
// the config layer only — anything the user's own instructions or in-session messages say takes
// precedence (proximate wins).

import { z } from "zod";

export const CONFIG_FILENAME = ".gh-conductor.toml";

/** How a workspace value got here: stated outright by the user, or inferred by the agent and
 * confirmed. A confirmed value that later collides with reality gets silently re-verified;
 * a stated one doesn't. */
export const Provenance = z.enum(["stated", "confirmed"]);
export type Provenance = z.infer<typeof Provenance>;

/** Every user-configurable preference. Policy defaults live here and nowhere else. */
export const SETTINGS = {
  byline: {
    schema: z.boolean(),
    default: true as boolean,
    description: "Attribution byline on issue bodies, PR bodies, and comments the agent writes",
  },
} as const;
export type SettingKey = keyof typeof SETTINGS;
export const settingKeys = Object.keys(SETTINGS) as SettingKey[];

/** Shape of .gh-conductor.toml. Every key optional; unknown keys are stripped, not errors, so an
 * older CLI tolerates a newer file. A test asserts this stays in sync with SETTINGS. */
export const ConfigFile = z.object({
  byline: z.boolean().optional(),
  provenance: z.record(z.string(), Provenance).optional(),
});
export type ConfigFile = z.infer<typeof ConfigFile>;

export const EffectiveSetting = z.object({
  key: z.string(),
  value: z.union([z.boolean(), z.number(), z.string()]),
  default: z.union([z.boolean(), z.number(), z.string()]),
  source: z.enum(["default", "workspace"]),
  provenance: Provenance.optional(),
  description: z.string(),
});
export type EffectiveSetting = z.infer<typeof EffectiveSetting>;

/** For `config --json`: tells the model how to weigh what it's reading. */
export const PRECEDENCE_NOTE =
  "These are configured defaults. Anything the user's own instructions (CLAUDE.md) or in-session messages say takes precedence over them.";

export function effectiveConfig(file: ConfigFile | null): EffectiveSetting[] {
  return settingKeys.map((key) => {
    const spec = SETTINGS[key];
    const fromFile = file?.[key];
    return {
      key,
      value: fromFile ?? spec.default,
      default: spec.default,
      source: fromFile === undefined ? ("default" as const) : ("workspace" as const),
      provenance: fromFile === undefined ? undefined : (file?.provenance?.[key] ?? "stated"),
      description: spec.description,
    };
  });
}

/** Parse a `config set` value string against the key's schema. Returns undefined if invalid. */
export function coerceSettingValue(key: SettingKey, raw: string): boolean | number | string | undefined {
  const candidates: unknown[] = [];
  if (raw === "true") candidates.push(true);
  if (raw === "false") candidates.push(false);
  const n = Number(raw);
  if (raw.trim() !== "" && !Number.isNaN(n)) candidates.push(n);
  candidates.push(raw);
  for (const c of candidates) {
    const parsed = SETTINGS[key].schema.safeParse(c);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

/** Serialize the constrained file shape (flat primitives plus the [provenance] table). TOML has no
 * general stringifier in Bun; this covers exactly what ConfigFile allows. JSON escaping is valid
 * for TOML basic strings. */
export function emitToml(file: ConfigFile): string {
  const lines: string[] = [
    "# gh-conductor preferences for this workspace. Edit freely, or let the agent",
    "# record them for you (`gh-conductor config set <key> <value>`).",
    "",
  ];
  for (const key of settingKeys) {
    const value = file[key];
    if (value !== undefined) lines.push(`${key} = ${JSON.stringify(value)}`);
  }
  const provenance = Object.entries(file.provenance ?? {}).filter(([key]) => file[key as SettingKey] !== undefined);
  if (provenance.length > 0) {
    lines.push("", "# stated = the user said so; confirmed = the agent inferred it and the user confirmed.", "[provenance]");
    for (const [key, value] of provenance) lines.push(`${key} = ${JSON.stringify(value)}`);
  }
  return `${lines.join("\n")}\n`;
}
