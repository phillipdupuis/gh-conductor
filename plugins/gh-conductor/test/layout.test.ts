import { describe, expect, test } from "bun:test";
import { GAP_Y, LAYER_WIDTH, MAX_VISIBLE_ROWS, NODE_HEIGHT, NODE_WIDTH, ROW_HEIGHT } from "../src/core/constants.ts";
import { layersOf } from "../src/core/layers.ts";
import { boundsOf, layoutGraph, type Box, type Layout, type LayerPlacement } from "../src/core/layout.ts";
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

describe("boundsOf", () => {
  const row = (p: Partial<LayerPlacement>): LayerPlacement => ({ layer: 0, issues: [], mode: "single", y: 0, height: 0, node: null, frame: null, toggle: null, ...p });

  test("covers every placed box: issue, list node, frame and toggle", () => {
    // Each box owns exactly one extreme, so dropping any one of the four sources changes the answer.
    const layout: Layout = {
      issues: [{ number: 1, layer: 0, x: 300, y: 100, width: 220, height: 56 }], // maxX = 520
      layers: [
        row({ layer: 0, node: { x: -180, y: 300, width: 360, height: 120 } }), // maxY = 420
        row({ layer: 1, frame: { x: -260, y: 0, width: 520, height: 80 }, toggle: { x: -48, y: -22, width: 96, height: 28 } }), // minX = -260, minY = -22
      ],
      edges: [],
    };
    expect(boundsOf(layout)).toEqual({ minX: -260, minY: -22, maxX: 520, maxY: 420 });
  });

  test("a layout that places nothing has zero bounds", () => {
    expect(boundsOf({ issues: [], layers: [], edges: [] })).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    // Rows exist but place no boxes (every single-mode row is its issues, and there are none).
    expect(boundsOf({ issues: [], layers: [row({}), row({ layer: 1 })], edges: [] })).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  test("a single box's bounds are the box itself", () => {
    const layout: Layout = { issues: [{ number: 7, layer: 0, x: -110, y: 64, width: 220, height: 56 }], layers: [], edges: [] };
    expect(boundsOf(layout)).toEqual({ minX: -110, minY: 64, maxX: 110, maxY: 120 });
  });

  test("bounds of a real layout start at the epic row's top edge", () => {
    const real = layoutGraph(g, layers, new Set());
    const b = boundsOf(real);
    expect(b.minY).toBe(0); // the epic row sits at y = 0
    expect(b.maxX - b.minX).toBe(LAYER_WIDTH); // the widest thing when collapsed is a list node
    const bottom = real.layers[0]!;
    expect(b.maxY).toBe(bottom.y + bottom.height);
  });
});
