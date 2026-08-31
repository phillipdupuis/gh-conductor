import { describe, expect, test } from "bun:test";
import { keyOf } from "../src/core/graph.ts";
import { layerOf, layersOf, toLayers, toposort } from "../src/core/layers.ts";
import { Graph, type Issue } from "../src/core/schema.ts";
import mid from "../fixtures/upgrade-python-mid.json";

const k = (n: number, repo = "northbeam/platform") => `${repo}#${n}`;

const g = Graph.parse(mid);
const layers = layersOf(g);
const at = layerOf(layers);

describe("layersOf (upgrade-python-mid)", () => {
  test("the critical path starts at layer 0 and climbs one layer per link", () => {
    expect(at.get(k(122))).toBe(0);
    expect(at.get(k(123))).toBe(1);
    expect(at.get(k(124))).toBe(2);
  });
  test("a parent sits above all of its children (containment counts as a dependency)", () => {
    expect(at.get(k(121))!).toBeGreaterThan(at.get(k(124))!);
    expect(at.get(k(130))!).toBe(at.get(k(131))! + 1);
  });
  test("siblings blocked by the same issue share a layer", () => {
    const migrations = [131, 132, 133, 134, 135, 136, 137, 138, 139, 140].map((n) => k(n));
    expect(new Set(migrations.map((n) => at.get(n))).size).toBe(1);
    expect(layers[at.get(k(131))!]).toEqual(migrations);
  });
  test("the epic is alone in its layer, under the work that waits on the whole epic", () => {
    expect(layers[layers.length - 1]).toEqual([k(145)]);
    expect(layers[layers.length - 2]).toEqual([k(120)]);
  });
  test("every issue is in exactly one layer, in graph order", () => {
    expect(layers.flat().sort()).toEqual([k(120), ...g.nodes.map(keyOf), ...g.related.map(keyOf)].sort());
    const order = new Map([g.epic, ...g.nodes, ...g.related].map((n, i) => [keyOf(n), i]));
    for (const layer of layers) expect([...layer].sort((a, b) => order.get(a)! - order.get(b)!)).toEqual(layer);
  });
  test("a blocker with slack floats up to just below its only dependent", () => {
    // #129 is blocked by devops#57 as well as by #125; nothing blocks #57 itself, so it could start
    // at the bottom — but it is not needed until #129, so it bands directly under it.
    expect(at.get(k(57, "northbeam/devops"))).toBe(at.get(k(129))! - 1);
    expect(at.get(k(129))!).toBe(at.get(k(125))! + 1);
  });
  test("a related issue nothing here waits on bands one above the epic", () => {
    expect(at.get(k(145))).toBe(at.get(k(120))! + 1);
  });
});

describe("as late as possible", () => {
  test("an unblocked node sits directly under its only dependent, not at the bottom", () => {
    const issue = (number: number, blockedBy: number[]): Issue => ({
      ...g.nodes[0]!,
      repo: "o/r",
      number,
      title: `#${number}`,
      parent: "o/r#1",
      depth: 1,
      blockedBy: blockedBy.map((n) => ({ repo: "o/r", number: n, title: `#${n}`, url: "", state: "open" as const })),
      pr: null,
      assignees: [],
    });
    // #2 → #3 → #4 → #5 is the critical path; #9 has no blockers but only #5 needs it.
    const nodes = [issue(2, []), issue(3, [2]), issue(4, [3]), issue(5, [4, 9]), issue(9, [])];
    const epic: Issue = { ...issue(1, []), parent: null, depth: 0 };
    const at2 = layerOf(layersOf({ repo: "o/r", viewer: null, epic, nodes, related: [] }));
    expect([2, 3, 4, 5].map((n) => at2.get(`o/r#${n}`))).toEqual([0, 1, 2, 3]);
    expect(at2.get("o/r#9")).toBe(at2.get("o/r#5")! - 1);
  });
});

describe("cycles", () => {
  test("toposort names the offending pair", () => {
    const deps = new Map<string, string[]>([
      [k(1), [k(2)]],
      [k(2), [k(3)]],
      [k(3), [k(1)]],
    ]);
    const keys = [k(1), k(2), k(3)];
    expect(() => toposort(keys, deps)).toThrow(/Cycle detected: \S+#\d+ → \S+#\d+/);
    expect(() => toLayers(keys, deps)).toThrow(/Cycle/);
  });
  test("a sub-issue blocked by its own parent is a cycle", () => {
    const parent: Issue = { ...g.nodes[0]!, number: 200, parent: null, title: "p", blockedBy: [] };
    const child: Issue = { ...g.nodes[0]!, number: 201, parent: k(200), title: "c", blockedBy: [{ repo: parent.repo, number: 200, title: "p", url: "", state: "open" }] };
    expect(() => layersOf({ ...g, nodes: [parent, child] })).toThrow(/Cycle/);
  });
});
