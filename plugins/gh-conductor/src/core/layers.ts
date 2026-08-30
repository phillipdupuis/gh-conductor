// DAG layers for the pipeline view. An issue's layer is one more than the highest layer among the
// things it depends on; layer 0 depends on nothing. "Depends on" = blocked by (within the graph) or
// contains (a parent can't close before its children), so a parent sits above its sub-issues and the
// epic is alone at the top. `toposort` / `toLayers` are ported from aidag's engine/graph-utils.

import { keyOf } from "./graph.ts";
import type { Graph } from "./schema.ts";

export type Deps = Map<string, Iterable<string>>;

/** Keys in dependency order (every key after everything it depends on). Throws on a cycle, naming the pair. */
export function toposort(keys: string[], deps: Deps): string[] {
  const sorted = new Set<string>();
  const visiting = new Set<string>();
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
      if (d === undefined) throw new Error(`no deps entry for ${current}`);
      let allSorted = true;
      for (const dep of d) {
        if (sorted.has(dep)) continue;
        if (visiting.has(dep)) throw new Error(`Cycle detected: ${current} → ${dep}`);
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
export function toLayers(keys: string[], deps: Deps): string[][] {
  const sortedKeys = toposort(keys, deps);
  const layerOf = new Map<string, number>();
  for (const key of sortedKeys) {
    let max = -1;
    for (const dep of deps.get(key)!) max = Math.max(max, layerOf.get(dep)!);
    layerOf.set(key, max + 1);
  }
  const layers: string[][] = [];
  for (const key of sortedKeys) {
    const i = layerOf.get(key)!;
    (layers[i] ??= []).push(key);
  }
  return layers;
}

/**
 * The graph's layers, index 0 = bottom (nothing blocking it), last = the epic. Each layer lists
 * issue keys in graph order (the depth-first sub-issue order the sidebar uses).
 */
export function layersOf(g: Graph): string[][] {
  const all = [g.epic, ...g.nodes, ...g.related];
  const order = new Map(all.map((n, i) => [keyOf(n), i]));
  const deps: Deps = new Map(all.map((n) => [keyOf(n), new Set<string>()]));
  for (const n of all) {
    const k = keyOf(n);
    for (const b of n.blockedBy) {
      const bk = keyOf(b);
      if (order.has(bk) && bk !== k) (deps.get(k) as Set<string>).add(bk);
    }
  }
  for (const n of g.nodes) (deps.get(n.parent ?? keyOf(g.epic)) as Set<string>).add(keyOf(n));
  // A related issue nothing here is blocked by has no dependency to lift it, so it would tie with
  // the epic's layer and read as parallel work. Make it depend on the epic: downstream of everything.
  const blockerKeys = new Set(all.flatMap((n) => n.blockedBy.map(keyOf).filter((k) => order.has(k))));
  for (const x of g.related) if (!blockerKeys.has(keyOf(x))) (deps.get(keyOf(x)) as Set<string>).add(keyOf(g.epic));
  const byOrder = (a: string, b: string) => order.get(a)! - order.get(b)!;
  return toLayers([...order.keys()], deps).map((layer) => [...layer].sort(byOrder));
}

/** issue key → layer index. */
export function layerOf(layers: string[][]): Map<string, number> {
  const out = new Map<string, number>();
  layers.forEach((layer, i) => layer.forEach((n) => out.set(n, i)));
  return out;
}
