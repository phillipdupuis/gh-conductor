import { describe, expect, test } from "bun:test";
import { layerOf, layersOf, toLayers, toposort } from "../src/core/layers.ts";
import { Graph, type Issue } from "../src/core/schema.ts";
import mid from "../fixtures/upgrade-python-mid.json";

const g = Graph.parse(mid);
const layers = layersOf(g);
const at = layerOf(layers);

describe("layersOf (upgrade-python-mid)", () => {
  test("nothing blocking → layer 0; each blocker pushes one layer up", () => {
    expect(at.get(122)).toBe(0);
    expect(at.get(123)).toBe(1);
    expect(at.get(124)).toBe(2);
  });
  test("a parent sits above all of its children (containment counts as a dependency)", () => {
    expect(at.get(121)!).toBeGreaterThan(at.get(124)!);
    expect(at.get(130)!).toBe(at.get(131)! + 1);
  });
  test("siblings blocked by the same issue share a layer", () => {
    const migrations = [131, 132, 133, 134, 135, 136, 137, 138, 139, 140];
    expect(new Set(migrations.map((n) => at.get(n))).size).toBe(1);
    expect(layers[at.get(131)!]).toEqual(migrations);
  });
  test("the epic is alone in the top layer", () => {
    expect(layers[layers.length - 1]).toEqual([120]);
  });
  test("every issue is in exactly one layer, in graph order", () => {
    expect(layers.flat().sort((a, b) => a - b)).toEqual([120, ...g.nodes.map((n) => n.number)].sort((a, b) => a - b));
    const order = new Map([g.epic, ...g.nodes].map((n, i) => [n.number, i]));
    for (const layer of layers) expect([...layer].sort((a, b) => order.get(a)! - order.get(b)!)).toEqual(layer);
  });
  test("blockers outside the graph are ignored", () => {
    // #129 is blocked by #57, which is not in the epic; it still layers right above #125.
    expect(at.get(129)).toBe(at.get(125)! + 1);
  });
});

describe("cycles", () => {
  test("toposort names the offending pair", () => {
    const deps = new Map<number, number[]>([
      [1, [2]],
      [2, [3]],
      [3, [1]],
    ]);
    expect(() => toposort([1, 2, 3], deps)).toThrow(/Cycle detected: #\d+ → #\d+/);
    expect(() => toLayers([1, 2, 3], deps)).toThrow(/Cycle/);
  });
  test("a sub-issue blocked by its own parent is a cycle", () => {
    const parent: Issue = { ...g.nodes[0]!, number: 200, parent: null, title: "p", blockedBy: [] };
    const child: Issue = { ...g.nodes[0]!, number: 201, parent: 200, title: "c", blockedBy: [{ number: 200, title: "p", url: "", state: "open" }] };
    expect(() => layersOf({ ...g, nodes: [parent, child] })).toThrow(/Cycle/);
  });
});
