import { describe, expect, test } from "bun:test";
import type { Snapshot } from "../src/diff.ts";
import {
  describeWatching,
  parseIssueRef,
  parseIssueRefs,
  reconcile,
  type Subscription,
} from "../src/subscriptions.ts";

const snapshot = (): Snapshot => ({ subIssues: new Map(), seenCommentIds: new Set([1]) });

const watching = (...labels: string[]): Map<string, Subscription> =>
  new Map(
    labels.map((label) => {
      const root = parseIssueRef(label);
      if (root === null) throw new Error(`test fixture "${label}" is not an issue reference`);
      return [label, { root, snapshot: snapshot(), lastSuccessAt: 1000 }];
    }),
  );

const refs = (...labels: string[]) => parseIssueRefs(labels).roots;

describe("parseIssueRef", () => {
  test("splits owner, repo and number out of owner/repo#number", () => {
    expect(parseIssueRef("acme/widgets#42")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
      label: "acme/widgets#42",
    });
  });

  test("tolerates surrounding whitespace", () => {
    expect(parseIssueRef("  acme/widgets#42  ")?.label).toBe("acme/widgets#42");
  });

  test("keeps dots and dashes in owner and repo names", () => {
    expect(parseIssueRef("phillip-d/gh.conductor#7")?.label).toBe("phillip-d/gh.conductor#7");
  });

  test.each([
    ["a bare number", "42"],
    ["no #", "acme/widgets"],
    ["a # with no number", "acme/widgets#"],
    ["a non-numeric number", "acme/widgets#abc"],
    ["a leading # on the repo", "acme#widgets"],
    ["an inner space", "acme/wid gets#42"],
    ["a space before the number", "acme/widgets# 42"],
    ["an empty string", ""],
    ["a url", "https://github.com/acme/widgets/issues/42"],
  ])("rejects %s", (_what, spec) => {
    expect(parseIssueRef(spec)).toBeNull();
  });
});

describe("parseIssueRefs", () => {
  test("returns every root when all refs parse", () => {
    const { roots, invalid } = parseIssueRefs(["acme/widgets#1", "acme/widgets#2"]);
    expect(roots.map((root) => root.label)).toEqual(["acme/widgets#1", "acme/widgets#2"]);
    expect(invalid).toEqual([]);
  });

  test("names every bad ref so a caller can reject the request whole", () => {
    const { roots, invalid } = parseIssueRefs(["acme/widgets#1", "nope", "acme/widgets#x"]);
    expect(invalid).toEqual(["nope", "acme/widgets#x"]);
    expect(roots.map((root) => root.label)).toEqual(["acme/widgets#1"]);
  });

  test("an empty request is valid and asks for nothing", () => {
    expect(parseIssueRefs([])).toEqual({ roots: [], invalid: [] });
  });
});

describe("reconcile", () => {
  test("a surviving root keeps its snapshot and poll anchor", () => {
    const current = watching("acme/widgets#1", "acme/widgets#2");
    const kept = current.get("acme/widgets#1");
    const next = reconcile(current, refs("acme/widgets#1"));
    expect(next.get("acme/widgets#1")).toBe(kept!);
  });

  test("a removed root is dropped along with its state", () => {
    const next = reconcile(watching("acme/widgets#1", "acme/widgets#2"), refs("acme/widgets#2"));
    expect([...next.keys()]).toEqual(["acme/widgets#2"]);
  });

  test("a new root starts empty so it baselines on its first poll", () => {
    const next = reconcile(watching("acme/widgets#1"), refs("acme/widgets#1", "acme/widgets#9"));
    expect(next.get("acme/widgets#9")).toEqual({
      root: parseIssueRef("acme/widgets#9")!,
      snapshot: null,
      lastSuccessAt: null,
    });
  });

  test("an empty request drops everything", () => {
    expect(reconcile(watching("acme/widgets#1"), []).size).toBe(0);
  });

  test("the current map is left untouched", () => {
    const current = watching("acme/widgets#1");
    reconcile(current, refs("acme/widgets#9"));
    expect([...current.keys()]).toEqual(["acme/widgets#1"]);
  });

  test("duplicate refs collapse to one subscription", () => {
    const next = reconcile(new Map(), refs("acme/widgets#1", "acme/widgets#1"));
    expect(next.size).toBe(1);
  });
});

describe("describeWatching", () => {
  test("lists the watched trees", () => {
    expect(describeWatching(["acme/widgets#1", "acme/widgets#9"])).toBe("Watching acme/widgets#1, acme/widgets#9");
  });

  test("says so when nothing is watched", () => {
    expect(describeWatching([])).toBe("Watching nothing.");
  });
});
