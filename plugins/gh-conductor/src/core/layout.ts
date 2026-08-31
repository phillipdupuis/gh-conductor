// Layers → positions. A grid of layer rows, the last layer at y = 0 and layer 0 at the bottom, so
// every edge points up and a node's row is the point it is needed by. A row is one of:
//   single    — at most COLLAPSE_THRESHOLD issues: plain issue nodes, never collapsible.
//   collapsed — one list node (`layer-<i>`) standing in for all of the layer's issues.
//   expanded  — one column per issue inside a frame, with a "Collapse" pill as a tab on the frame's top edge.
// Pure and synchronous, so expand/collapse re-lays out instantly in the browser.

import {
  COLLAPSE_THRESHOLD,
  FOOTER_HEIGHT,
  FRAME_PAD,
  GAP_X,
  GAP_Y,
  LAYER_WIDTH,
  MAX_VISIBLE_ROWS,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_HEIGHT,
  TOGGLE_HEIGHT,
  TOGGLE_OVERLAP,
  TOGGLE_WIDTH,
} from "./constants.ts";
import { keyOf } from "./graph.ts";
import type { Graph } from "./schema.ts";

/** Top-left origin, px (React Flow's convention). */
export type Box = { x: number; y: number; width: number; height: number };

export type IssuePlacement = Box & { key: string; layer: number };

export type LayerMode = "single" | "collapsed" | "expanded";

export type LayerPlacement = {
  layer: number;
  issues: string[];
  mode: LayerMode;
  /** Top of the row and its height. */
  y: number;
  height: number;
  /** The list node's box when collapsed. */
  node: Box | null;
  /** The border around the columns when expanded. */
  frame: Box | null;
  /** The "Collapse" pill's box when expanded; straddles the frame's top edge. */
  toggle: Box | null;
};

export type EdgeKind = "blocking" | "tree";

/**
 * An edge between representatives: an issue node id (its key) or a collapsed layer (`layer-<i>`).
 * Keys always contain a "#", so the two id spaces cannot collide. Several issue-level edges can
 * collapse into one; `pairs` keeps them for the trace.
 */
export type LayoutEdge = { id: string; source: string; target: string; kind: EdgeKind; pairs: [string, string][] };

export type Layout = { issues: IssuePlacement[]; layers: LayerPlacement[]; edges: LayoutEdge[] };

/** Node id of a collapsed layer. */
export const layerId = (layer: number) => `layer-${layer}`;

/**
 * The bounding box of everything a layout places — issue placements and each layer's list node,
 * frame and toggle. In layout px, so the viewport can be sized and anchored without measuring the
 * DOM. A layout that places nothing has zero bounds.
 */
export function boundsOf(layout: Layout): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const cover = (b: Box) => {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  };
  for (const p of layout.issues) cover(p);
  for (const l of layout.layers) for (const b of [l.node, l.frame, l.toggle]) if (b) cover(b);
  return minX === Infinity ? { minX: 0, minY: 0, maxX: 0, maxY: 0 } : { minX, minY, maxX, maxY };
}

export const isCollapsible = (layer: string[]) => layer.length > COLLAPSE_THRESHOLD;

export function layerMode(layer: string[], index: number, expanded: ReadonlySet<number>): LayerMode {
  if (!isCollapsible(layer)) return "single";
  return expanded.has(index) ? "expanded" : "collapsed";
}

export function rowHeight(layer: string[], mode: LayerMode): number {
  if (mode === "collapsed") return Math.min(layer.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT + FOOTER_HEIGHT;
  return mode === "expanded" ? NODE_HEIGHT + 2 * FRAME_PAD : NODE_HEIGHT;
}

export function layoutGraph(g: Graph, layers: string[][], expanded: ReadonlySet<number>): Layout {
  const issues: IssuePlacement[] = [];
  const placements: LayerPlacement[] = [];
  const rep = new Map<string, string>();

  // Rows, top (last layer) to bottom (layer 0).
  let y = 0;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]!;
    const mode = layerMode(layer, i, expanded);
    const height = rowHeight(layer, mode);
    let node: Box | null = null;
    let frame: Box | null = null;
    let toggle: Box | null = null;
    if (mode === "collapsed") {
      node = { x: -LAYER_WIDTH / 2, y, width: LAYER_WIDTH, height };
      for (const n of layer) rep.set(n, layerId(i));
    } else {
      const span = layer.length * NODE_WIDTH + (layer.length - 1) * GAP_X;
      const x0 = -span / 2;
      const pad = mode === "expanded" ? FRAME_PAD : 0;
      layer.forEach((n, j) => {
        issues.push({ key: n, layer: i, x: x0 + j * (NODE_WIDTH + GAP_X), y: y + pad, width: NODE_WIDTH, height: NODE_HEIGHT });
        rep.set(n, n);
      });
      if (mode === "expanded") {
        frame = { x: x0 - pad, y, width: span + 2 * pad, height };
        toggle = { x: -TOGGLE_WIDTH / 2, y: y - TOGGLE_HEIGHT + TOGGLE_OVERLAP, width: TOGGLE_WIDTH, height: TOGGLE_HEIGHT };
      }
    }
    placements.push({ layer: i, issues: layer, mode, y, height, node, frame, toggle });
    y += height + GAP_Y;
  }
  placements.reverse();

  // Edges between representatives. Same-layer edges can't exist: an edge always crosses upward.
  const edges = new Map<string, LayoutEdge>();
  const add = (from: string, to: string, kind: EdgeKind) => {
    const source = rep.get(from);
    const target = rep.get(to);
    if (!source || !target || source === target) return;
    const id = `${source}->${target}`;
    const e = edges.get(id);
    if (e) {
      e.pairs.push([from, to]);
      if (kind === "blocking") e.kind = "blocking";
    } else edges.set(id, { id, source, target, kind, pairs: [[from, to]] });
  };
  for (const n of g.nodes) add(keyOf(n), n.parent ?? keyOf(g.epic), "tree");
  for (const n of [g.epic, ...g.nodes, ...g.related]) for (const b of n.blockedBy) add(keyOf(b), keyOf(n), "blocking");

  return { issues, layers: placements, edges: [...edges.values()] };
}
