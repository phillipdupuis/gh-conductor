import { describe, expect, test } from "bun:test";
import { GAP_Y, LAYER_WIDTH, MAX_VISIBLE_ROWS, NODE_HEIGHT, NODE_WIDTH, ROW_HEIGHT } from "../src/core/constants.ts";
import { layersOf } from "../src/core/layers.ts";
import { layoutGraph, type Box } from "../src/core/layout.ts";
import { Graph } from "../src/core/schema.ts";
import mid from "../fixtures/upgrade-python-mid.json";

const g = Graph.parse(mid);
const layers = layersOf(g);

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("layoutGraph (upgrade-python-mid, everything collapsed)", () => {
  const layout = layoutGraph(g, layers, new Set());
  const boxes: Box[] = [...layout.issues, ...layout.layers.flatMap((l) => (l.node ? [l.node] : []))];

  test("one node per layer: plain issues for singletons, one list node otherwise", () => {
    expect(boxes.length).toBe(layers.length);
    expect(layout.layers.filter((l) => l.mode === "collapsed").map((l) => l.issues.length)).toEqual([2, 10]);
    expect(layout.layers.every((l) => l.toggle === null)).toBe(true);
  });
  test("rows are stacked top-down at GAP_Y pitch, the epic at y = 0", () => {
    const top = layout.layers[layout.layers.length - 1]!;
    expect(top.y).toBe(0);
    expect(top.issues).toEqual([120]);
    for (let i = layers.length - 1; i > 0; i--) {
      const above = layout.layers[i]!;
      const below = layout.layers[i - 1]!;
      expect(below.y).toBe(above.y + above.height + GAP_Y);
    }
  });
  test("a collapsed node caps at MAX_VISIBLE_ROWS and is centred like everything else", () => {
    const ten = layout.layers.find((l) => l.issues.length === 10)!;
    const two = layout.layers.find((l) => l.issues.length === 2)!;
    expect(ten.node).toMatchObject({ x: -LAYER_WIDTH / 2, width: LAYER_WIDTH });
    expect(ten.height - two.height).toBe((MAX_VISIBLE_ROWS - 2) * ROW_HEIGHT);
    for (const p of layout.issues) expect(p).toMatchObject({ x: -NODE_WIDTH / 2, width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  test("no two boxes overlap", () => {
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
  });
  test("edges join representatives, deduped, and keep the underlying pairs", () => {
    const ids = new Set(layout.edges.map((e) => e.id));
    expect(ids.size).toBe(layout.edges.length);
    const fanIn = layout.edges.find((e) => e.source === "129" && e.target.startsWith("layer-"))!;
    expect(fanIn.kind).toBe("blocking");
    expect(fanIn.pairs.length).toBe(10);
    const up = layout.edges.find((e) => e.source.startsWith("layer-") && e.target === "130")!;
    expect(up.kind).toBe("tree");
    expect(layout.edges.every((e) => e.source !== e.target)).toBe(true);
  });
});

describe("layoutGraph (expanded)", () => {
  const ten = layers.findIndex((l) => l.length === 10);
  const layout = layoutGraph(g, layers, new Set([ten]));

  test("an expanded layer becomes framed columns with a centred toggle on the frame's top edge, nothing overlapping", () => {
    const row = layout.layers[ten]!;
    expect(row.mode).toBe("expanded");
    expect(row.node).toBeNull();
    const { frame, toggle } = row;
    expect(frame).not.toBeNull();
    expect(toggle).not.toBeNull();
    const cols = layout.issues.filter((p) => p.layer === ten);
    expect(cols.length).toBe(10);
    const inside = (a: Box, b: Box) => a.x >= b.x && a.x + a.width <= b.x + b.width && a.y >= b.y && a.y + a.height <= b.y + b.height;
    for (const c of cols) expect(inside(c, frame!)).toBe(true);
    expect(frame!.height).toBe(row.height);
    // Toggle: horizontally centred, straddling the top border, clear of the columns.
    expect(toggle!.x + toggle!.width / 2).toBe(0);
    expect(toggle!.y).toBeLessThan(frame!.y);
    expect(toggle!.y + toggle!.height).toBeGreaterThan(frame!.y);
    const boxes: Box[] = [...layout.issues, ...layout.layers.flatMap((l) => [l.node, l.toggle].filter((b): b is Box => b !== null))];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
  });
  test("edges fan out to the individual issues", () => {
    expect(layout.edges.filter((e) => e.source === "129" && e.kind === "blocking").length).toBe(10);
  });
});
