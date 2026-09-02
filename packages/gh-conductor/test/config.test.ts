import { describe, expect, test } from "bun:test";
import {
  ConfigFile,
  SETTINGS,
  coerceSettingValue,
  effectiveConfig,
  emitToml,
  settingKeys,
} from "../src/core/config.ts";

describe("schema", () => {
  test("ConfigFile covers every SETTINGS key (and only those, plus provenance)", () => {
    expect(Object.keys(ConfigFile.shape).sort()).toEqual([...settingKeys, "provenance"].sort());
  });

  test("unknown keys are stripped, not errors (older CLI, newer file)", () => {
    const parsed = ConfigFile.parse({ byline: false, future_setting: "x" });
    expect(parsed).toEqual({ byline: false });
  });
});

describe("effectiveConfig", () => {
  test("no file → every setting at its default, source default, no provenance", () => {
    for (const s of effectiveConfig(null)) {
      expect(s.value).toBe(SETTINGS[s.key as keyof typeof SETTINGS].default);
      expect(s.source).toBe("default");
      expect(s.provenance).toBeUndefined();
    }
  });

  test("file value wins and carries provenance (defaulting to stated)", () => {
    const [byline] = effectiveConfig({ byline: false });
    expect(byline).toMatchObject({
      key: "byline",
      value: false,
      default: true,
      source: "workspace",
      provenance: "stated",
    });
    const [confirmed] = effectiveConfig({ byline: false, provenance: { byline: "confirmed" } });
    expect(confirmed?.provenance).toBe("confirmed");
  });
});

describe("coerceSettingValue", () => {
  test("booleans parse from true/false, reject anything else", () => {
    expect(coerceSettingValue("byline", "false")).toBe(false);
    expect(coerceSettingValue("byline", "true")).toBe(true);
    expect(coerceSettingValue("byline", "yes")).toBeUndefined();
    expect(coerceSettingValue("byline", "0")).toBeUndefined();
  });
});

describe("emitToml", () => {
  test("round-trips through Bun's TOML parser", () => {
    const file = { byline: false, provenance: { byline: "confirmed" as const } };
    expect(ConfigFile.parse(Bun.TOML.parse(emitToml(file)))).toEqual(file);
  });

  test("empty file emits only the header comment", () => {
    const out = emitToml({});
    expect(ConfigFile.parse(Bun.TOML.parse(out))).toEqual({});
    expect(out).not.toContain("[provenance]");
  });

  test("provenance for an unset key is dropped", () => {
    const out = emitToml({ provenance: { byline: "stated" } });
    expect(out).not.toContain("[provenance]");
  });
});
