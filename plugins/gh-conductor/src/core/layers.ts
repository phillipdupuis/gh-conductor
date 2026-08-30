// DAG layers for the pipeline view. An issue's layer is one more than the highest layer among the
// things it depends on; layer 0 depends on nothing. "Depends on" = blocked by (within the graph) or
// contains (a parent can't close before its children), so a parent sits above its sub-issues and the
// epic is alone at the top. `toposort` / `toLayers` are ported from aidag's engine/graph-utils.

import type { Graph } from "./schema.ts";

export type Deps = Map<number, Iterable<number>>;

/** Keys in dependency order (every key after everything it depends on). Throws on a cycle, naming the pair. */
export function toposort(keys: number[], deps: Deps): number[] {
  const sorted = new Set<number>();
  const visiting = new Set<number>();
  for (const key of new Set(keys)) {
    if (sorted.has(key)) continue;
    const work = [key];
    while (work.length) {
      const current = work[work.length - 1]!;
      if (sorted.has(current)) {
        work.pop();
        continue;
      }
      visiting.add(current);
      const d = deps.get(current);
      if (d === undefined) throw new Error(`no deps entry for #${current}`);
      let allSorted = true;
      for (const dep of d) {
        if (sorted.has(dep)) continue;
        if (visiting.has(dep)) throw new Error(`Cycle detected: #${current} → #${dep}`);
        allSorted = false;
        work.push(dep);
      }
      if (allSorted) {
        work.pop();
        sorted.add(current);
        visiting.delete(current);
      }
    }
  }
  return [...sorted];
}

/** Group keys into layers: layers[i] depends only on layers[0..i-1]. Order within a layer = toposort order. */
export function toLayers(keys: number[], deps: Deps): number[][] {
  const sortedKeys = toposort(keys, deps);
  const layerOf = new Map<number, number>();
  for (const key of sortedKeys) {
    let max = -1;
    for (const dep of deps.get(key)!) max = Math.max(max, layerOf.get(dep)!);
    layerOf.set(key, max + 1);
  }
  const layers: number[][] = [];
  for (const key of sortedKeys) {
    const i = layerOf.get(key)!;
    (layers[i] ??= []).push(key);
  }
  return layers;
}

/**
 * The graph's layers, index 0 = bottom (nothing blocking it), last = the epic. Each layer lists
 * issue numbers in graph order (the depth-first sub-issue order the sidebar uses).
 */
export function layersOf(g: Graph): number[][] {
  const all = [g.epic, ...g.nodes];
  const order = new Map(all.map((n, i) => [n.number, i]));
  const deps: Deps = new Map(all.map((n) => [n.number, new Set<number>()]));
  for (const n of g.nodes) {
    for (const b of n.blockedBy) if (order.has(b.number) && b.number !== n.number) (deps.get(n.number) as Set<number>).add(b.number);
    (deps.get(n.parent ?? g.epic.number) as Set<number>).add(n.number);
  }
  for (const b of g.epic.blockedBy) if (order.has(b.number) && b.number !== g.epic.number) (deps.get(g.epic.number) as Set<number>).add(b.number);
  const byOrder = (a: number, b: number) => order.get(a)! - order.get(b)!;
  return toLayers([...order.keys()], deps).map((layer) => [...layer].sort(byOrder));
}

/** issue number → layer index. */
export function layerOf(layers: number[][]): Map<number, number> {
  const out = new Map<number, number>();
  layers.forEach((layer, i) => layer.forEach((n) => out.set(n, i)));
  return out;
}
